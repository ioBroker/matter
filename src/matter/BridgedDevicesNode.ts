import { VendorId } from '@project-chip/matter.js/datatype';
import { DeviceTypes } from '@project-chip/matter.js/device';

import { GenericDevice } from '../lib';
import { BridgeDeviceDescription } from '../ioBrokerStorageTypes';
import { Logger } from '@project-chip/matter.js/log';

import matterDeviceFactory from './matterFactory';
import VENDOR_IDS from './vendorIds';
import type { MatterAdapter } from '../main';
import { ServerNode } from '@project-chip/matter.js/node';
import { SessionsBehavior } from '@project-chip/matter.js/behavior/system/sessions';
import { Endpoint } from '@project-chip/matter.js/endpoint';
import { AggregatorEndpoint } from '@project-chip/matter.js/endpoint/definitions';
import {
    BridgedDeviceBasicInformationServer
} from '@project-chip/matter.js/behavior/definitions/bridged-device-basic-information';
import { BaseServerNode, ConnectionInfo, NodeStateResponse, NodeStates } from './BaseServerNode';

export interface BridgeCreateOptions {
    parameters: BridgeOptions,
    devices: GenericDevice[];
    devicesOptions: BridgeDeviceDescription[];
}

export interface BridgeOptions {
    uuid: string;
    vendorId: number;
    productId: number;
    deviceName: string;
    productName: string;
    port: number;
}

class BridgedDevices extends BaseServerNode {
    private parameters: BridgeOptions;
    private readonly devices: GenericDevice[];
    private devicesOptions: BridgeDeviceDescription[];
    private commissioned: boolean | null = null;

    constructor(adapter: MatterAdapter, options: BridgeCreateOptions) {
        super(adapter);
        this.parameters = options.parameters;
        this.devices = options.devices;
        this.devicesOptions = options.devicesOptions;
    }

    get uuid(): string {
        return this.parameters.uuid;
    }

    async init(): Promise<void> {
        await this.adapter.extendObject(`bridges.${this.parameters.uuid}.commissioned`, {
            type: 'state',
            common: {
                name: 'commissioned',
                type: 'boolean',
                role: 'indicator',
                read: true,
                write: false,
            },
            native: {},
        });

        /**
         * Collect all needed data
         *
         * This block makes sure to collect all needed data from cli or storage. Replace this with where ever your data
         * come from.
         *
         * Note: This example also uses the initialized storage system to store the device parameter data for convenience
         * and easy reuse. When you also do that be careful to not overlap with Matter-Server own contexts
         * (so maybe better not ;-)).
         */
        const deviceName = this.parameters.deviceName || 'Matter Bridge device';
        const deviceType = DeviceTypes.AGGREGATOR.code;
        const vendorName = 'ioBroker';

        // product name / id and vendor id should match what is in the device certificate
        const vendorId = this.parameters.vendorId;// 0xfff1;
        const productName = `ioBroker Bridge`;
        const productId = this.parameters.productId; // 0x8000;

        const uniqueId = this.parameters.uuid.replace(/-/g, '').split('.').pop() || '0000000000000000';

        /**
         * Create Matter Server and CommissioningServer Node
         *
         * To allow the device to be announced, found, paired and operated, we need a MatterServer instance and add a
         * serverNode to it and add the just created device instance to it.
         * The CommissioningServer node defines the port where the server listens for the UDP packages of the Matter protocol
         * and initializes deice specific certificates and such.
         *
         * The below logic also adds command handlers for commands of clusters that normally are handled internally
         * like testEventTrigger (General Diagnostic Cluster) that can be implemented with the logic when these commands
         * are called.
         */
        this.serverNode = await ServerNode.create({
            id: this.parameters.uuid,
            network: {
                port: this.parameters.port
            },
            productDescription: {
                name: deviceName,
                deviceType,
            },
            basicInformation: {
                vendorName,
                vendorId: VendorId(vendorId),
                nodeLabel: productName,
                productName,
                productLabel: productName,
                productId,
                serialNumber: uniqueId,
                uniqueId,
            },
        });

        /**
         * Create Device instance and add needed Listener
         *
         * Create an instance of the matter device class you want to use.
         * This example uses the OnOffLightDevice or OnOffPluginUnitDevice depending on the value of the type parameter.
         * To execute the on/off scripts defined as parameters, a listener for the onOff attribute is registered via the
         * device specific API.
         *
         * The below logic also adds command handlers for commands of clusters that normally are handled device internally
         * like identify that can be implemented with the logic when these commands are called.
         */

        const aggregator = new Endpoint(AggregatorEndpoint, { id: 'bridge' });

        await this.serverNode.add(aggregator);

        for (let i = 0; i < this.devices.length; i++) {
            const ioBrokerDevice = this.devices[i];
            const mappingDevice = await matterDeviceFactory(ioBrokerDevice, this.devicesOptions[i].name, this.devicesOptions[i].uuid);
            if (mappingDevice) {
                const name = mappingDevice.getName();
                const bridgedDevice = mappingDevice.getMatterDevice();
                bridgedDevice.behaviors.require(BridgedDeviceBasicInformationServer, {
                    nodeLabel: name,
                    productName: name,
                    productLabel: name,
                    uniqueId: this.devicesOptions[i].uuid[i].replace(/-/g, ''),
                    reachable: true,
                });
                await aggregator.add(bridgedDevice);
                await mappingDevice.init();
            } else {
                this.adapter.log.error(`ioBroker Device in Bridge "${this.devices[i].getDeviceType()}" is not supported`);
            }
        }

        this.serverNode.events.commissioning.fabricsChanged.on(async(fabricIndex) => {
            this.adapter.log.debug(
                `commissioningChangedCallback: Commissioning changed on Fabric ${fabricIndex}: ${this.serverNode?.state.operationalCredentials.fabrics.find(fabric => fabric.fabricIndex === fabricIndex)}`);
            // TODO find replacement for ${Logger.toJSON(this.serverNode?.getCommissionedFabricInformation(fabricIndex)[0])}
            await this.adapter.sendToGui({ command: 'updateStates', states: { [this.parameters.uuid]: await this.getState() } });
        });

        const sessionChange = async(session: SessionsBehavior.Session): Promise<void> => {
            this.adapter.log.debug(
                `activeSessionsChangedCallback: Active sessions changed on Fabric ${session.fabric?.fabricIndex}` +
                Logger.toJSON(session));
            await this.adapter.sendToGui({ command: 'updateStates', states: { [this.parameters.uuid]: await this.getState() } });
        };
        this.serverNode.events.sessions.opened.on(sessionChange);
        this.serverNode.events.sessions.closed.on(sessionChange);
        this.serverNode.events.sessions.subscriptionsChanged.on(sessionChange);
    }

    async applyConfiguration(_options: BridgeCreateOptions): Promise<void> {
        // TODO
    }

    async getState(): Promise<NodeStateResponse> {
        if (!this.serverNode) {
            return {
                status: NodeStates.Creating,
            };
        }
        /**
         * Print Pairing Information
         *
         * If the device is not already commissioned (this info is stored in the storage system) then get and print the
         * pairing details. This includes the QR code that can be scanned by the Matter app to pair the device.
         */

        // this.adapter.log.info('Listening');

        if (!this.serverNode?.lifecycle.isCommissioned) {
            if (this.commissioned !== false) {
                this.commissioned = false;
                await this.adapter.setState(`bridges.${this.parameters.uuid}.commissioned`, this.commissioned, true);
            }
            const { qrPairingCode, manualPairingCode } = this.serverNode?.state.commissioning.pairingCodes;
            return {
                status: NodeStates.WaitingForCommissioning,
                qrPairingCode: qrPairingCode,
                manualPairingCode: manualPairingCode,
            };
        } else {
            if (this.commissioned !== true) {
                this.commissioned = true;
                await this.adapter.setState(`bridges.${this.parameters.uuid}.commissioned`, this.commissioned, true);
            }

            const activeSessions = Object.values(this.serverNode.state.sessions.sessions);
            const fabrics = Object.values(this.serverNode.state.commissioning.fabrics);

            const connectionInfo: ConnectionInfo[] = activeSessions.map(session => {
                const vendorId = session?.fabric?.rootVendorId;
                return {
                    vendor: (vendorId && VENDOR_IDS[vendorId]) || `0x${(vendorId || 0).toString(16)}`,
                    connected: !!session.numberOfActiveSubscriptions,
                    label: session?.fabric?.label,
                };
            });

            fabrics.forEach(fabric => {
                if (!activeSessions.find(session => session.fabric?.fabricId === fabric.fabricId)) {
                    connectionInfo.push({
                        vendor: VENDOR_IDS[fabric?.rootVendorId] || `0x${(fabric?.rootVendorId || 0).toString(16)}`,
                        connected: false,
                        label: fabric?.label,
                    });
                }
            });

            if (connectionInfo.find(info => info.connected)) {
                console.log('Device is already commissioned and connected with controller');
                return {
                    status: NodeStates.ConnectedWithController,
                    connectionInfo,
                };
            } else {
                console.log('Device is already commissioned. Waiting for controllers to connect ...');
                return {
                    status: NodeStates.Commissioned,
                    connectionInfo,
                };
            }
        }
    }

    async start(): Promise<void> {
        if (!this.serverNode) {
            return;
        }
        await this.serverNode.bringOnline();
    }

    async stop(): Promise<void> {
        for (let d = 0; d < this.devices.length; d++) {
            await this.devices[d].destroy();
        }
        await this.serverNode?.close();
    }
}

export default BridgedDevices;
