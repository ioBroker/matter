import type { MatterAdapter } from '../main';
import {
    type ActionContext,
    type ApiVersion,
    type ConfigItemAny,
    type DeviceDetails,
    type DeviceInfo,
    type DeviceRefresh,
    type DeviceStatus,
    type InstanceDetails,
    type JsonFormSchema,
    type JsonFormData,
    type ConfigConnectionType,
    DeviceManagement,
    ACTIONS,
} from '@iobroker/dm-utils';
import type { GeneralMatterNode, NodeDetails } from '../matter/GeneralMatterNode';
import { GenericDeviceToIoBroker } from '../matter/to-iobroker/GenericDeviceToIoBroker';
import type { DeviceAction } from '@iobroker/dm-utils/build/types/base';
import { logEndpoint } from '../matter/EndpointStructureInspector';
import { inspect } from 'util';
import { convertDataToJsonConfig } from './JsonConfigUtils';

function strToBool(str: string): boolean | null {
    if (str === 'true') {
        return true;
    }
    if (str === 'false') {
        return false;
    }
    return null;
}

class MatterAdapterDeviceManagement extends DeviceManagement<MatterAdapter> {
    #adapter: MatterAdapter;

    constructor(adapter: MatterAdapter) {
        super(adapter);
        this.#adapter = adapter;
    }

    async getInstanceInfo(): Promise<InstanceDetails> {
        return {
            ...(await super.getInstanceInfo()),
            apiVersion: 'v1' as ApiVersion,
            actions: [
                /*{
                    id: 'newDevice',
                    icon: 'fas fa-plus',
                    title: '',
                    description: {
                        en: 'Add new device to Zigbee',
                        de: 'Neues Gerät zu Zigbee hinzufügen',
                        ru: 'Добавить новое устройство в Zigbee',
                        pt: 'Adicionar novo dispositivo ao Zigbee',
                        nl: 'Voeg nieuw apparaat toe aan Zigbee',
                        fr: 'Ajouter un nouvel appareil à Zigbee',
                        it: 'Aggiungi nuovo dispositivo a Zigbee',
                        es: 'Agregar nuevo dispositivo a Zigbee',
                        pl: 'Dodaj nowe urządzenie do Zigbee',

                        uk: 'Додати новий пристрій до Zigbee',
                    },
                    handler: this.handleNewDevice.bind(this),
                },*/
            ],
        };
    }

    // contents see in the next chapters
    async listDevices(): Promise<DeviceInfo[]> {
        if (!this.#adapter.controllerNode) {
            return []; // TODO How to return that no controller is started?
        }

        const nodes = this.#adapter.controllerNode.nodes;

        const arrDevices: DeviceInfo[] = [];
        for (const ioNode of nodes.values()) {
            const devices = await this.#getNodeEntry(ioNode);
            arrDevices.push(...devices);
        }

        /*arrDevices.push({
            id: demoDevice.id,
            name: demoDevice.name,
            // icon: devices[i].common.icon ? devices[i].common.icon : null,
            manufacturer: 'ioBroker',
            model: 'Model Demo',
            status: 'connected',
            hasDetails: true,
            actions: [
                {
                    id: 'delete',
                    icon: '',
                    description: this.#adapter.t('Delete this device'),
                    handler: this.handleDeleteDevice.bind(this),
                },
                {
                    id: 'rename',
                    icon: '',
                    description: this.#adapter.t('Rename this device'),
                    handler: this.#handleRenameDevice.bind(this),
                },
            ],
            controls: [
                {
                    type: 'icon',
                    state: this.#demoState || undefined,
                    stateId: 'javascript.0.RGB.on',
                    id: 'light',
                    handler: this.handleControlDevice.bind(this),
                    getStateHandler: this.handleGetControlState.bind(this),
                    colorOn: '#cbbc0e',
                },
            ],
        });*/

        return arrDevices;
    }

    /**
     * Create the "Node" device entry and also add all Endpoint-"Devices" for Device-Manager
     */
    async #getNodeEntry(ioNode: GeneralMatterNode): Promise<DeviceInfo[]> {
        const status: DeviceStatus = await ioNode.getStatus();
        const isEnabled = ioNode.isEnabled;
        const isConnected = ioNode.isConnected;
        const id = ioNode.nodeId;
        const details = ioNode.details;

        let actions: (DeviceAction<'adapter'> | null)[] = [
            {
                // This is a special action when the user clicks on the status icon
                id: ACTIONS.STATUS,
                handler: (_id, context) => this.#handleOnStatusNode(ioNode, context),
            },
            {
                // This is a special action when the user clicks on the enabled icon
                id: ACTIONS.ENABLE_DISABLE,
                handler: (_id, context) => this.#handleEnableOrDisableNode(ioNode, context),
            },
            {
                id: 'deleteNode',
                icon: 'delete',
                description: this.#adapter.getText('Unpair this node'),
                handler: (_id, context) => this.#handleDeleteNode(ioNode, context),
            },
            {
                id: 'renameNode',
                icon: 'edit',
                description: this.#adapter.getText('Rename this node'),
                handler: (_id, context) => this.#handleRenameNode(ioNode, context),
            },
            // this command is not available if a device is offline
            isConnected
                ? {
                      id: 'pairingCodeNode',
                      icon: 'qrcode',
                      description: this.#adapter.getText('Generate new pairing code'),
                      handler: (_id, context) => this.#handlePairingCode(ioNode, context),
                  }
                : null,
            isConnected
                ? {
                      id: 'configureNode',
                      icon: 'settings',
                      description: this.#adapter.getText('Configure this node'),
                      handler: (_id, context) => this.#handleConfigureNode(ioNode, context),
                  }
                : null,
            {
                id: 'logNodeDebug',
                icon: 'lines',
                description: this.#adapter.getText('Output Debug details this node'),
                handler: (_id, context) => this.#handleLogDebugNode(ioNode, context),
            },
        ];

        // remove null actions
        actions = actions?.filter(it => it) || [];

        const connectionType = ioNode.connectionType;
        const res = new Array<DeviceInfo>();
        const node: DeviceInfo = {
            id,
            name: `Node ${ioNode.name}`,
            icon: undefined,
            ...details,
            status,
            enabled: isEnabled,
            connectionType,
            hasDetails: true,
            actions: actions.length ? (actions as DeviceAction<'adapter'>[]) : undefined,
            color: 'secondary',
            group: {
                key: 'node',
                name: this.#adapter.getText('Node'),
                icon: 'node',
            },
        };

        res.push(node);

        if (isEnabled) {
            let deviceCount = 0;
            for (const device of ioNode.devices.values()) {
                const deviceInfo = await this.#getNodeDeviceEntries(device, id, details, isConnected, connectionType);
                res.push(deviceInfo);
                deviceCount++;
            }
            // define the icon depends on the number of sub-devices
            node.icon = ioNode.hasAggregatorEndpoint ? 'hub5' : deviceCount > 1 ? 'hub3' : 'node';
        } else {
            node.icon = 'node';
        }

        return res;
    }

    /**
     * Create one Endpoint-"Device" for Device-Manager
     */
    async #getNodeDeviceEntries(
        device: GenericDeviceToIoBroker,
        nodeId: string,
        nodeDetails: NodeDetails,
        nodeConnected: boolean,
        nodeConnectionType: ConfigConnectionType,
    ): Promise<DeviceInfo> {
        const data: DeviceInfo = {
            id: `${nodeId}-${device.number}`,
            name: device.name,
            icon: device.iconDeviceType,
            ...nodeDetails,
            status: await device.getStatus({
                connection: nodeConnected ? 'connected' : 'disconnected',
            }),
            connectionType: nodeConnectionType,
            hasDetails: true,
            actions: [
                {
                    id: 'renameDevice',
                    icon: 'rename',
                    description: this.#adapter.getText('Rename this device'),
                    handler: (id, context) => this.#handleRenameDevice(device, context),
                },
                {
                    id: 'configureDevice',
                    icon: 'settings',
                    description: this.#adapter.getText('Configure this device'),
                    handler: (id, context) => this.#handleConfigureDevice(device, context),
                },
            ],
            group: {
                key: `device/${device.deviceType}`,
                name: this.#adapter.getText(device.deviceType),
                icon: device.iconDeviceType,
            },
        };

        if (device.hasIdentify() && nodeConnected) {
            data.actions!.push({
                id: 'identify',
                icon: 'identify',
                description: this.#adapter.getText('Identify this device'),
                handler: (id, context) => this.#handleIdentifyDevice(device, context),
            });
        }

        return data;
    }

    async #handleEnableOrDisableNode(
        node: GeneralMatterNode,
        context: ActionContext,
    ): Promise<{ refresh: DeviceRefresh }> {
        if (node.isEnabled) {
            if (
                !(await context.showConfirmation(
                    this.#adapter.t('Are you sure you want to disable and disconnect the node?'),
                ))
            ) {
                return { refresh: false };
            }
        }
        await node.setEnabled(!node.isEnabled);

        if (node.isEnabled) {
            await context.showMessage(
                this.#adapter.t(
                    'Node got enabled and will be connected now. It might take a moment until the devices of this node are shown.',
                ),
            );
        }

        return { refresh: true };
    }

    async #handleOnStatusNode(node: GeneralMatterNode, context: ActionContext): Promise<{ refresh: DeviceRefresh }> {
        const schema = convertDataToJsonConfig(await node.getConnectionStatus());

        await context.showForm(schema, {
            data: {},
            maxWidth: 'md',
            title: this.#adapter.getText('Connection Status'),
            buttons: [
                {
                    type: 'cancel',
                    label: this.#adapter.getText('Close'),
                },
            ],
        });

        return { refresh: false };
    }

    async #handleDeleteNode(node: GeneralMatterNode, context: ActionContext): Promise<{ refresh: DeviceRefresh }> {
        this.adapter.log.info(`Delete node ${node.nodeId}`);
        if (!(await context.showConfirmation(this.#adapter.t('Are you sure?')))) {
            return { refresh: false };
        }

        if (!node.node.isConnected) {
            if (
                !(await context.showConfirmation(
                    this.#adapter.t(
                        'The node is currently not connected. When you unpair it now you need to factory reset the node to commission again. Are you sure?',
                    ),
                ))
            ) {
                return { refresh: false };
            }
        }

        await this.#adapter.sendToGui({
            command: 'progress',
            progress: {
                title: this.#adapter.t('Unpairing node...'),
                indeterminate: true,
                value: 0,
            },
        });

        // Start an interval that normally covers 30 seconds, and with each update the number gets slower increased for the percentage
        let errorHappened = false;
        try {
            await node.remove();
        } catch (error) {
            const errorText = inspect(error, { depth: 10 });
            this.adapter.log.error(`Error during unpairing for node ${node.nodeId}: ${errorText}`);
            errorHappened = true;
        }

        await this.#adapter.sendToGui({
            command: 'progress',
            progress: {
                close: true,
            },
        });

        if (errorHappened) {
            await context.showMessage(this.#adapter.t('Error happened during unpairing. Please check the log.'));
        }
        return { refresh: true };
    }

    async #handleRenameNode(node: GeneralMatterNode, context: ActionContext): Promise<{ refresh: DeviceRefresh }> {
        const result = await context.showForm(
            {
                type: 'panel',
                items: {
                    name: {
                        type: 'text',
                        label: this.#adapter.getText('Name'),
                        allowEmpty: false,
                        sm: 12,
                    },
                },
                style: {
                    minWidth: 200,
                },
            },
            {
                data: {
                    name: node.name,
                },
                title: this.#adapter.getText('Rename node'),
            },
        );

        if (result?.name !== undefined && result.name !== node.name) {
            this.adapter.log.info(`Rename node ${node.nodeId} to "${result.name}"`);
            await node.rename(result.name);
            return { refresh: true };
        }
        return { refresh: false };
    }

    /**
     * Handle new pairing code request
     */
    async #handlePairingCode(node: GeneralMatterNode, context: ActionContext): Promise<{ refresh: DeviceRefresh }> {
        const result = await this.adapter.controllerNode?.showNewCommissioningCode(node.node.nodeId);

        this.adapter.log.info(`New pairing code for node ${node.nodeId}: ${JSON.stringify(result)}`);

        if (result?.manualPairingCode || result?.qrPairingCode) {
            const schema: JsonFormSchema = {
                type: 'panel',
                label: this.#adapter.getText('Pairing Code'),
                noTranslation: true,
                items: {},
            };
            if (result.manualPairingCode) {
                schema.items._text = {
                    type: 'text',
                    sm: 12,
                    readOnly: true,
                    copyToClipboard: true,
                    label: this.#adapter.getText('Use the following pairing code to commission the device'),
                    default: result.manualPairingCode,
                };
            }
            if (result.qrPairingCode) {
                schema.items._qrCode = {
                    type: 'qrCode',
                    newLine: true,
                    sm: 12,
                    size: 80,
                    data: result.qrPairingCode,
                };
            }

            await context.showForm(schema, {
                title: this.#adapter.getText('Pair with Device'),
                buttons: ['cancel'],
                maxWidth: 'md',
            });
        } else {
            await context.showMessage(this.#adapter.t('No paring code received'));
        }

        return { refresh: false };
    }

    async #handleLogDebugNode(node: GeneralMatterNode, context: ActionContext): Promise<{ refresh: DeviceRefresh }> {
        const rootEndpoint = node.node.getRootEndpoint();

        const debugInfos = rootEndpoint ? logEndpoint(rootEndpoint) : 'No root endpoint found';

        await context.showForm(
            {
                type: 'panel',
                items: {
                    _instructions: {
                        type: 'staticText',
                        text: this.#adapter.getText(
                            'In case of issues with this node please copy and post these details together with Debug logs to the issue.',
                        ),
                    },
                    debugInfos: {
                        type: 'text',
                        label: this.#adapter.getText('Debug Infos'),
                        minRows: 30,
                        sm: 12,
                        readOnly: true,
                        copyToClipboard: true,
                        trim: false,
                        noClearButton: true,
                    },
                },
            },
            {
                data: { debugInfos },
                maxWidth: 'md',
                title: this.#adapter.getText('Debug Infos'),
                buttons: [
                    {
                        type: 'cancel',
                        label: this.#adapter.getText('Close'),
                    },
                ],
            },
        );

        return { refresh: false };
    }

    async #handleConfigureNodeOrDevice(
        title: string,
        baseId: string,
        context: ActionContext,
        nodeOrDevice: GeneralMatterNode | GenericDeviceToIoBroker,
    ): Promise<{ refresh: DeviceRefresh }> {
        const obj = await this.adapter.getObjectAsync(baseId);

        // const node = nodeOrDevice instanceof GeneralMatterNode ? nodeOrDevice : undefined;
        const device = nodeOrDevice instanceof GenericDeviceToIoBroker ? nodeOrDevice : undefined;

        const items: Record<string, ConfigItemAny> = {
            exposeMatterApplicationClusterData: {
                type: 'select',
                label: this.#adapter.t('Expose Matter Application Cluster Data'),
                options: [
                    { label: this.#adapter.t('Yes'), value: 'true' },
                    { label: this.#adapter.t('No'), value: 'false' },
                    { label: this.#adapter.t('Default'), value: '' },
                ],
                noTranslation: true,
                sm: 12,
            },
            exposeMatterSystemClusterData: {
                type: 'select',
                label: this.#adapter.t('Expose Matter System Cluster Data'),
                noTranslation: true,
                options: [
                    { label: this.#adapter.t('Yes'), value: 'true' },
                    { label: this.#adapter.t('No'), value: 'false' },
                    { label: this.#adapter.t('Default'), value: '' },
                ],
                sm: 12,
            },
        };
        const data: JsonFormData = {
            exposeMatterApplicationClusterData:
                typeof obj?.native.exposeMatterApplicationClusterData !== 'boolean'
                    ? ''
                    : obj?.native.exposeMatterApplicationClusterData
                      ? 'true'
                      : 'false',
            exposeMatterSystemClusterData:
                typeof obj?.native.exposeMatterSystemClusterData !== 'boolean'
                    ? ''
                    : obj?.native.exposeMatterSystemClusterData
                      ? 'true'
                      : 'false',
        };

        if (device !== undefined) {
            const deviceConfig = device.deviceConfiguration;
            if (deviceConfig.pollInterval !== undefined) {
                items.pollInterval = {
                    type: 'number',
                    label: this.#adapter.getText('Energy Attribute Polling Interval (s)'),
                    min: 30,
                    max: 2147482,
                    sm: 12,
                };
                data.pollInterval = deviceConfig.pollInterval;
            }
        }

        const result = await context.showForm(
            {
                type: 'panel',
                items,
                style: {
                    minWidth: 300,
                },
            },
            {
                data,
                title: this.#adapter.getText(title),
            },
        );

        if (result?.pollInterval !== undefined && device !== undefined) {
            device.setDeviceConfiguration({ pollInterval: result.pollInterval });
        }

        if (
            result?.exposeMatterApplicationClusterData !== undefined &&
            result?.exposeMatterSystemClusterData !== undefined
        ) {
            await this.adapter.extendObjectAsync(baseId, {
                native: {
                    exposeMatterApplicationClusterData: strToBool(result.exposeMatterApplicationClusterData),
                    exposeMatterSystemClusterData: strToBool(result.exposeMatterSystemClusterData),
                    ...(device !== undefined ? device.deviceConfiguration : {}),
                },
            });
        }
        return { refresh: false };
    }

    async #handleConfigureNode(node: GeneralMatterNode, context: ActionContext): Promise<{ refresh: DeviceRefresh }> {
        this.adapter.log.info(`Configure node ${node.nodeId}`);

        return await this.#handleConfigureNodeOrDevice('Configure node', node.nodeBaseId, context, node);
    }

    async #handleConfigureDevice(
        device: GenericDeviceToIoBroker,
        context: ActionContext,
    ): Promise<{ refresh: DeviceRefresh }> {
        this.adapter.log.info(`Configure device ${device.name}`);

        return await this.#handleConfigureNodeOrDevice('Configure device', device.baseId, context, device);
    }

    async #handleIdentifyDevice(
        device: GenericDeviceToIoBroker,
        context: ActionContext,
    ): Promise<{ refresh: DeviceRefresh }> {
        await device.identify();

        await context.showMessage(this.#adapter.t(`The device should now identify itself for 30 seconds.`));

        return { refresh: false };
    }

    /*async handleControlDevice(
        _deviceId: string,
        _actionId: string,
        state: ControlState,
        _context: ActionContext,
    ): Promise<ErrorResponse | ioBroker.State> {
        if (this.#demoState) {
            this.#demoState.val = state as boolean;
            this.#demoState.ts = Date.now();
            await this.adapter.setForeignStateAsync('javascript.0.RGB.on', this.#demoState);

            return this.#demoState;
        }
        return { error: { code: 404, message: 'State not found' } };
    }

    async handleGetControlState(
        _deviceId: string,
        _actionId: string,
        _context: ActionContext,
    ): Promise<ErrorResponse | ioBroker.State> {
        if (this.#demoState) {
            return this.#demoState;
        }
        return { error: { code: 404, message: 'State not found' } };
    }*/

    async #handleRenameDevice(
        device: GenericDeviceToIoBroker,
        context: ActionContext,
    ): Promise<{ refresh: DeviceRefresh }> {
        const result = await context.showForm(
            {
                type: 'panel',
                items: {
                    name: {
                        type: 'text',
                        label: this.#adapter.getText('Name'),
                        allowEmpty: false,
                        sm: 12,
                    },
                },
                style: {
                    minWidth: 200,
                },
            },
            {
                data: {
                    name: device.name,
                },
                title: this.#adapter.getText('Rename device'),
            },
        );

        if (result?.name !== undefined && result.name !== device.name) {
            this.adapter.log.info(`Rename device ${device.name} to "${result.name}"`);
            await device.rename(result.name);
            return { refresh: true };
        }
        return { refresh: false };
    }

    async getDeviceDetails(id: string): Promise<DeviceDetails | null | { error: string }> {
        this.adapter.log.debug(`Get details ${id}`);

        const idParts = id.split('-');
        const nodeId = idParts[0];
        const endpointId = idParts[1] !== undefined ? parseInt(idParts[1], 10) : undefined;

        const node = this.#adapter.controllerNode?.nodes.get(nodeId);

        if (!node) {
            return { error: 'Node not found' };
        }

        if (endpointId === undefined) {
            // Get Node details
            const schema = convertDataToJsonConfig(await node.getNodeDetails());
            return { id, schema, data: {} };
        }

        // Get Endpoint details
        const device = node.devices.get(endpointId);
        if (!device) {
            return { error: 'Device not found' };
        }

        const schema = convertDataToJsonConfig(await device.getDeviceDetails());

        return { id, schema, data: {} };
    }

    async close(): Promise<void> {
        // do nothing
    }
}

export default MatterAdapterDeviceManagement;
