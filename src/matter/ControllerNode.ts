import { Logger, NodeId, singleton, VendorId, type ServerAddressIp } from '@matter/main';
import { GeneralCommissioning } from '@matter/main/clusters';
import {
    Ble,
    type CommissionableDevice,
    type ControllerCommissioningFlowOptions,
    type DiscoveryData,
} from '@matter/main/protocol';
import { ManualPairingCodeCodec, QrPairingCodeCodec } from '@matter/main/types';
import { NodeJsBle } from '@matter/nodejs-ble';
import { CommissioningController, type NodeCommissioningOptions } from '@project-chip/matter.js';
import {
    NodeStates as PairedNodeStates,
    type CommissioningControllerNodeOptions,
    type PairedNode,
} from '@project-chip/matter.js/device';
import type { MatterControllerConfig } from '../../src-admin/src/types';
import type { MatterAdapter } from '../main';
import { GeneralMatterNode, type PairedNodeConfig } from './GeneralMatterNode';
import type { GeneralNode, MessageResponse } from './GeneralNode';
import { inspect } from 'util';

export interface ControllerCreateOptions {
    adapter: MatterAdapter;
    controllerOptions: MatterControllerConfig;
    updateCallback: () => void;
    fabricLabel: string;
}

interface AddDeviceResult {
    result: boolean;
    /** The error message */
    error?: string;
    nodeId?: string;
}

type EndUserCommissioningOptions = (
    | { qrCode: string }
    | { manualCode: string }
    | { passcode: number; vendorId: number; productId: number; ip: string; port: number }
) & { device: CommissionableDevice };

class Controller implements GeneralNode {
    #parameters: MatterControllerConfig;
    readonly #adapter: MatterAdapter;
    readonly #updateCallback: () => void;
    #fabricLabel: string;
    #commissioningController?: CommissioningController;
    #nodes = new Map<string, GeneralMatterNode>();
    #discovering = false;
    #useBle = false;
    #commissioningStatus = new Map<number, { status: 'finished' | 'error' | 'inprogress'; result?: MessageResponse }>();

    constructor(options: ControllerCreateOptions) {
        const { adapter, controllerOptions, updateCallback, fabricLabel } = options;
        this.#adapter = adapter;
        this.#parameters = controllerOptions;
        this.#updateCallback = updateCallback;
        this.#fabricLabel = fabricLabel;
    }

    get nodes(): Map<string, GeneralMatterNode> {
        return this.#nodes;
    }

    init(): void {
        if (this.#parameters.ble) {
            if (
                (this.#parameters.wifiSSID && this.#parameters.wifiPassword) ||
                (this.#parameters.threadNetworkName !== undefined &&
                    this.#parameters.threadOperationalDataSet !== undefined)
            ) {
                try {
                    const hciId = this.#parameters.hciId === undefined ? undefined : parseInt(this.#parameters.hciId);
                    Ble.get = singleton(() => new NodeJsBle({ hciId }));
                    this.#useBle = true;
                } catch (error) {
                    this.#adapter.log.warn(`Failed to initialize BLE: ${error.message}`);
                    this.#parameters.ble = false;
                    return;
                }
            } else {
                this.#adapter.log.warn(
                    `BLE enabled but no WiFi or Thread configuration provided. BLE will stay disabled.`,
                );
                this.#parameters.ble = false;
            }
        }
        this.applyConfiguration(this.#parameters, true);
    }

    applyConfiguration(config: MatterControllerConfig, isInit = false): MessageResponse {
        const currentConfig: MatterControllerConfig = {
            enabled: true,
            defaultExposeMatterApplicationClusterData: false,
            defaultExposeMatterSystemClusterData: false,
            ...(this.#parameters as Partial<MatterControllerConfig>),
        };

        if (!isInit && (config.ble !== currentConfig.ble || config.hciId !== currentConfig.hciId)) {
            this.#adapter.setTimeout(() => this.#adapter.restart(), 5000);
            // Restart of the adapter needed
            return {
                error: `BLE configuration adjusted. The adapter will restart in 5 seconds.`,
            };
        }
        this.#parameters = config;
        return { result: true };
    }

    async applyPairedNodeConfiguration(nodeId: string, config: PairedNodeConfig, forcedUpdate = false): Promise<void> {
        const node = this.#nodes.get(nodeId);
        if (node === undefined) {
            this.#adapter.log.warn(`Node ${nodeId} not found`);
            return;
        }
        return node.applyConfiguration(config, forcedUpdate);
    }

    async handleCommand(obj: ioBroker.Message): Promise<MessageResponse> {
        if (this.#commissioningController === undefined) {
            return { error: 'Controller is not initialized.' };
        }
        const { command, message } = obj;
        try {
            switch (command) {
                case 'controllerDiscovery':
                    // Discover for Matter devices in the IP and potentially BLE network
                    // Response is handled by method and runs asynchronous
                    await this.#discovery(obj);
                    return;
                case 'controllerDiscoveryStop':
                    // Stop Discovery
                    if (this.#discovering) {
                        await this.#discoveryStop();
                        return { result: 'ok' };
                    }
                    // let's return ok because in fact it is stopped
                    return { result: 'ok' };
                case 'controllerCommissionDevice': {
                    // Commission a new device with Commissioning payloads like a QR Code or pairing code
                    const options = message as EndUserCommissioningOptions;
                    if (message.pollResponse) {
                        const pollingId = Date.now(); // should be good enough
                        this.#commissioningStatus.set(pollingId, { status: 'inprogress' });
                        // We return the pollingId and execute the commissioning async
                        this.commissionDevice(options)
                            .then(result => this.#commissioningStatus.set(pollingId, { status: 'finished', result }))
                            .catch(error =>
                                this.#commissioningStatus.set(pollingId, {
                                    status: 'error',
                                    result: { error: error.message },
                                }),
                            )
                            .finally(() => setTimeout(() => this.#commissioningStatus.delete(pollingId), 60 * 60_000));
                        return { result: { pollingId } };
                    }
                    return await this.commissionDevice(options);
                }
                case 'controllerCommissionDeviceStatus': {
                    // Get the status of a commissioning process
                    const pollingId = message.pollingId as number;
                    const status = this.#commissioningStatus.get(pollingId);
                    if (status === undefined) {
                        this.#adapter.log.warn(`No commissioning process with pollingId ${pollingId} found`);
                        return { error: `No commissioning process with pollingId ${pollingId} found.` };
                    }
                    const { status: statusText, result } = status;
                    this.#adapter.log.debug(
                        `Commissioning process with pollingId ${pollingId} is in status ${statusText}`,
                    );
                    if (statusText === 'inprogress') {
                        return { result: { status: statusText } };
                    }
                    return result;
                }
                case 'controllerDeviceQrCode':
                    // Opens a new commissioning window for a paired node and returns the QRCode and pairing code for display
                    return { result: await this.showNewCommissioningCode(message.nodeId) };
                case 'controllerInitializePaseCommissioner': {
                    // Returns the data needed to initialize a PaseCommissioner on the mobile App
                    const { caConfig, fabricData } = this.#commissioningController.paseCommissionerConfig;
                    return {
                        result: {
                            rootCertificateData: caConfig,
                            fabricData,
                        },
                    };
                }
                case 'controllerCompletePaseCommissioning':
                    // Completes a commissioning process that was started by the mobile app in the main controller
                    return await this.completeCommissioningForNode(message.peerNodeId, message.discoveryData);
            }
        } catch (error) {
            const errorText = inspect(error, { depth: 10 });
            this.#adapter.log.warn(`Error while executing command "${command}": ${errorText}`);
            return { error: `Error while executing command "${command}": ${error.message}`, result: false };
        }

        return { error: `Unknown command "${command}"` };
    }

    #registerNodeHandlers(node: PairedNode): void {
        node.events.attributeChanged.on(data => {
            void this.#nodes.get(node.nodeId.toString())?.handleChangedAttribute(data);
        });
        node.events.eventTriggered.on(data => {
            void this.#nodes.get(node.nodeId.toString())?.handleTriggeredEvent(data);
        });
        node.events.stateChanged.on(async (info: PairedNodeStates) => {
            const nodeDetails = (this.#commissioningController?.getCommissionedNodesDetails() ?? []).find(
                n => n.nodeId === node.nodeId,
            );
            const nodeIdStr = node.nodeId.toString();
            const deviceNode = this.#nodes.get(nodeIdStr);
            if (deviceNode) {
                await deviceNode.handleStateChange(info, nodeDetails);
            } else {
                if (info !== PairedNodeStates.Disconnected) {
                    this.#adapter.log.info(
                        `Matter node "${nodeIdStr}" not initialized ... Got State change to ${info}`,
                    );
                }
            }
            this.#updateCallback();
        });
        node.events.structureChanged.on(async () => {
            this.#adapter.log.info(`Node "${node.nodeId}" structure changed`);
            await this.nodeToIoBrokerStructure(node);
            this.#updateCallback();
        });
        node.events.decommissioned.on(() => {
            this.#adapter.log.info(`Node "${node.nodeId}" decommissioned`);
            // TODO Delete the node from config and objects
            this.#updateCallback();
        });
    }

    get nodeConnectSettings(): CommissioningControllerNodeOptions {
        return {
            subscribeMinIntervalFloorSeconds: 1,
            subscribeMaxIntervalCeilingSeconds: undefined,
        };
    }

    async start(): Promise<void> {
        if (this.#commissioningController) {
            throw new Error('CommissioningController already started!');
        }

        this.#commissioningController = new CommissioningController({
            autoConnect: false,
            environment: {
                environment: this.#adapter.matterEnvironment,
                id: 'controller',
            },
            adminFabricLabel: this.#fabricLabel,
        });

        await this.#adapter.extendObjectAsync('controller.info', {
            type: 'channel',
            common: {
                name: 'Information',
            },
            native: {},
        });

        await this.#adapter.extendObjectAsync('controller.info.discovering', {
            type: 'state',
            common: {
                name: 'Discovering',
                role: 'indicator',
                type: 'boolean',
                read: true,
                write: false,
                def: false,
            },
            native: {},
        });

        await this.#adapter.setState('controller.info.discovering', false, true);

        try {
            await this.#commissioningController.start();
        } catch (error) {
            const errorText = inspect(error, { depth: 10 });
            this.#adapter.log.error(`Failed to start the controller: ${errorText}`);
            return;
        }

        // get nodes
        const nodes = this.#commissioningController.getCommissionedNodes();
        this.#adapter.log.info(`Found ${nodes.length} nodes: ${Logger.toJSON(nodes)}`);

        const nodesDetails = this.#commissioningController.getCommissionedNodesDetails();
        // attach all nodes to the controller
        for (const nodeId of nodes) {
            try {
                this.#adapter.log.info(`Initializing to node "${nodeId}" ...`);
                const node = await this.#commissioningController.getNode(nodeId);
                this.#registerNodeHandlers(node);
                await this.nodeToIoBrokerStructure(
                    node,
                    nodesDetails.find(n => n.nodeId === nodeId),
                    this.nodeConnectSettings,
                );
            } catch (error) {
                this.#adapter.log.info(`Failed to connect to node "${nodeId}": ${error.stack}`);
            }
        }
    }

    async nodeToIoBrokerStructure(
        node: PairedNode,
        nodeDetails?: { operationalAddress?: string },
        connectOptions?: CommissioningControllerNodeOptions,
    ): Promise<void> {
        if (!node.initialized) {
            await node.events.initialized; // eslint is wrong, can be awaited
        }

        const nodeIdStr = node.nodeId.toString();

        // find and clear the old device if existing
        const oldDevice = this.#nodes.get(nodeIdStr);
        await oldDevice?.destroy();

        const device = new GeneralMatterNode(this.#adapter, node, this.#parameters);
        this.#nodes.set(nodeIdStr, device);
        await device.initialize(nodeDetails);
        device.connect(connectOptions);
    }

    async getState(): Promise<void> {
        // nothing to do
    }

    async commissionDevice(data: EndUserCommissioningOptions): Promise<AddDeviceResult> {
        if (!this.#commissioningController) {
            return { error: 'Controller is not activated.', result: false };
        }
        const commissioningOptions: ControllerCommissioningFlowOptions = {
            regulatoryLocation: GeneralCommissioning.RegulatoryLocationType.IndoorOutdoor,
            regulatoryCountryCode: 'XX',
        };

        if (this.#useBle) {
            if (this.#parameters.wifiSSID && this.#parameters.wifiPassword) {
                this.#adapter.log.debug(`Registering Commissioning over BLE with WiFi: ${this.#parameters.wifiSSID}`);
                commissioningOptions.wifiNetwork = {
                    wifiSsid: this.#parameters.wifiSSID,
                    wifiCredentials: this.#parameters.wifiPassword,
                };
            }
            if (
                this.#parameters.threadNetworkName !== undefined &&
                this.#parameters.threadOperationalDataSet !== undefined
            ) {
                this.#adapter.log.debug(
                    `Registering Commissioning over BLE with Thread: ${this.#parameters.threadNetworkName}`,
                );
                commissioningOptions.threadNetwork = {
                    networkName: this.#parameters.threadNetworkName,
                    operationalDataset: this.#parameters.threadOperationalDataSet,
                };
            }
        }

        let passcode: number | undefined = undefined;
        let shortDiscriminator: number | undefined = undefined;
        let longDiscriminator: number | undefined = undefined;
        let productId: number | undefined = undefined;
        let vendorId: VendorId | undefined = undefined;
        let knownAddress: ServerAddressIp | undefined = undefined;
        if ('manualCode' in data && data.manualCode.length > 0) {
            const pairingCodeCodec = ManualPairingCodeCodec.decode(data.manualCode);
            shortDiscriminator = pairingCodeCodec.shortDiscriminator;
            longDiscriminator = undefined;
            passcode = pairingCodeCodec.passcode;
        } else if ('qrCode' in data && data.qrCode.length > 0) {
            const pairingCodeCodec = QrPairingCodeCodec.decode(data.qrCode);
            // TODO handle the case where multiple devices are included
            longDiscriminator = pairingCodeCodec[0].discriminator;
            shortDiscriminator = undefined;
            passcode = pairingCodeCodec[0].passcode;
        } else if ('passcode' in data) {
            passcode = data.passcode;
            // TODO also use vendor Id once matter.js can discover for both together
            // TODO also try ip/port once matter.js can use this without a full discoverableDevice
            vendorId = VendorId(data.vendorId);
            productId = data.productId;
            if (data.ip && data.port) {
                // Mainly Android
                if (data.ip.startsWith('/')) {
                    // Sometimes strange character is there
                    data.ip = data.ip.substring(1);
                }
                // Link local addresses from Mobile devices are not really useful
                if (!data.ip.startsWith('fe80')) {
                    knownAddress = {
                        type: 'udp',
                        ip: data.ip,
                        port: data.port,
                    };
                }
            }
        }
        const { device } = data;
        if (device) {
            longDiscriminator = undefined;
            shortDiscriminator = undefined;
        }

        // this.#adapter.log.debug(`Commissioning ... ${JSON.stringify(options)}`);
        if (passcode === undefined) {
            throw new Error('Passcode is missing');
        }

        const options: NodeCommissioningOptions = {
            ...this.nodeConnectSettings,
            commissioning: commissioningOptions,
            discovery: {
                knownAddress,
                commissionableDevice: device || undefined,
                identifierData:
                    longDiscriminator !== undefined
                        ? { longDiscriminator }
                        : shortDiscriminator !== undefined
                          ? { shortDiscriminator }
                          : vendorId !== undefined
                            ? { vendorId, productId }
                            : undefined,
            },
            passcode,
        };

        const nodeId = await this.#commissioningController.commissionNode(options);

        await this.registerCommissionedNode(nodeId);

        return { result: true, nodeId: nodeId.toString() };
    }

    async completeCommissioningForNode(nodeId: NodeId, discoveryData?: DiscoveryData): Promise<AddDeviceResult> {
        if (!this.#commissioningController) {
            return {
                result: false,
                error: `Can not register NodeId "${nodeId}" because controller not initialized.`,
            };
        }

        await this.#commissioningController.completeCommissioningForNode(nodeId, discoveryData);

        await this.registerCommissionedNode(nodeId);

        return { result: true, nodeId: nodeId.toString() };
    }

    async registerCommissionedNode(nodeId: NodeId): Promise<void> {
        if (!this.#commissioningController) {
            throw new Error(`Can not register NodeId "${nodeId}" because controller not initialized.`);
        }

        const node = this.#commissioningController.getPairedNode(nodeId);
        if (node === undefined) {
            // should never happen
            throw new Error(`Node ${nodeId} is not connected but commissioning was successful. Should not happen.`);
        }

        this.#registerNodeHandlers(node);
        await this.nodeToIoBrokerStructure(
            node,
            this.#commissioningController.getCommissionedNodesDetails().find(n => n.nodeId === nodeId),
        );

        this.#adapter.log.debug(`Commissioning successfully completed with nodeId "${nodeId}"`);
        this.#updateCallback();
    }

    async #discovery(obj: ioBroker.Message): Promise<void> {
        if (!this.#commissioningController) {
            return;
        }
        await this.#adapter.setState('controller.info.discovering', true, true);
        this.#discovering = true;
        this.#adapter.log.info(`Start the discovering...`);
        this.#commissioningController
            .discoverCommissionableDevices(
                {},
                {
                    ble: this.#useBle,
                    onIpNetwork: true,
                },
                device => {
                    this.#adapter.log.debug(`Discovered Device: ${Logger.toJSON(device)}`);
                    if (this.#discovering) {
                        this.#adapter
                            .sendToGui({
                                command: 'discoveredDevice',
                                device,
                            })
                            .catch(error => this.#adapter.log.info(`Error sending to GUI: ${error}`));
                    }
                },
                60, // timeoutSeconds
            )
            .then(result => {
                this.#adapter.log.info(`Discovering stopped. Found ${result.length} devices.`);
                this.#adapter
                    .setState('controller.info.discovering', false, true)
                    .catch(error => this.#adapter.log.info(`Error setting state: ${error}`));
                this.#discovering = false;
                if (obj.callback) {
                    this.#adapter.log.info(`Sending result to "${JSON.stringify(result)}"`);
                    this.#adapter.sendTo(obj.from, obj.command, { result }, obj.callback);
                }
            })
            .catch(error => {
                const errorText = inspect(error, { depth: 10 });
                this.#adapter.log.warn(`Error while handling command "${obj.command}" for controller: ${errorText}`);
                if (obj.callback) {
                    this.#adapter.sendTo(obj.from, obj.command, { error: error.message }, obj.callback);
                }
            });
    }

    async #discoveryStop(): Promise<void> {
        if (this.#commissioningController && this.#discovering) {
            this.#discovering = false;
            await this.#adapter.setState('controller.info.discovering', false, true);
            this.#adapter.log.info(`Stop the discovering...`);
            this.#commissioningController.cancelCommissionableDeviceDiscovery(
                {},
                {
                    ble: this.#useBle,
                    onIpNetwork: true,
                },
            );
        }
    }

    async showNewCommissioningCode(nodeId: NodeId): Promise<{
        manualPairingCode: string;
        qrPairingCode: string;
    } | null> {
        if (!this.#commissioningController) {
            return null;
        }
        const node = this.#commissioningController.getPairedNode(nodeId);
        if (node) {
            return await node.openEnhancedCommissioningWindow();
        }
        return null;
    }

    async stop(): Promise<void> {
        this.#adapter.log.info(`Stopping Controller...`);
        if (this.#discovering) {
            await this.#discoveryStop();
        }

        for (const node of this.#nodes.values()) {
            await node.destroy();
        }

        this.#nodes.clear();

        if (this.#commissioningController) {
            await this.#commissioningController.close();
            this.#commissioningController = undefined;
        }
    }

    async decommissionNode(nodeId: string): Promise<void> {
        if (!this.#commissioningController) {
            throw new Error(`Can not decommission NodeId "${nodeId}" because controller not initialized.`);
        }
        await this.#commissioningController.removeNode(
            NodeId(BigInt(nodeId)),
            !!this.#nodes.get(nodeId)?.node.isConnected,
        );
        this.#nodes.delete(nodeId);
        this.#updateCallback();
    }
}

export default Controller;
