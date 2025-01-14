import { capitalize, ClusterId, Logger, type NodeId, serialize } from '@matter/main';
import {
    BasicInformationCluster,
    BridgedDeviceBasicInformation,
    GeneralDiagnosticsCluster,
    WiFiNetworkDiagnosticsCluster,
    OperationalCredentialsCluster,
} from '@matter/main/clusters';
import { AttributeModel, ClusterModel, CommandModel, MatterModel } from '@matter/main/model';
import {
    type DecodedAttributeReportValue,
    type DecodedEventReportValue,
    FabricScopeError,
    SupportedAttributeClient,
    UnknownSupportedAttributeClient,
} from '@matter/main/protocol';
import { GlobalAttributes, SpecificationVersion } from '@matter/main/types';
import { AggregatorEndpointDefinition, BridgedNodeEndpointDefinition } from '@matter/main/endpoints';
import {
    type Endpoint,
    NodeStates,
    type PairedNode,
    type CommissioningControllerNodeOptions,
} from '@project-chip/matter.js/device';
import type { MatterControllerConfig } from '../../src-admin/src/types';
import { SubscribeManager } from '../lib';
import type { SubscribeCallback } from '../lib/SubscribeManager';
import { bytesToIpV4, bytesToIpV6, bytesToMac, decamelize, toHex } from '../lib/utils';
import type { MatterAdapter } from '../main';
import type { GenericDeviceToIoBroker } from './to-iobroker/GenericDeviceToIoBroker';
import ioBrokerDeviceFabric, { identifyDeviceTypes } from './to-iobroker/ioBrokerFactory';
import type { StructuredJsonFormData } from '../lib/JsonConfigUtils';
import type { DeviceStatus, ConfigConnectionType } from '@iobroker/dm-utils';

export type PairedNodeConfig = {
    nodeId: NodeId;
    exposeMatterApplicationClusterData: boolean;
    exposeMatterSystemClusterData: boolean;
};

const SystemClusters: ClusterId[] = [
    ClusterId(0x0004), // Groups
    ClusterId(0x0005), // Scenes
    ClusterId(0x001d), // Descriptor
    ClusterId(0x001e), // Binding
    ClusterId(0x001f), // Access Control
    ClusterId(0x002b), // Localization Configuration
    ClusterId(0x002c), // Time Format Localization
    ClusterId(0x002d), // Unit Localization
    ClusterId(0x002e), // Power Source Configuration
    ClusterId(0x0030), // General Commissioning
    ClusterId(0x0031), // Network Commissioning
    ClusterId(0x0032), // Diagnostic Logs
    ClusterId(0x0033), // General Diagnostics
    ClusterId(0x0034), // Software Diagnostics
    ClusterId(0x0035), // Thread Network Diagnostics
    ClusterId(0x0036), // Wi-Fi Network Diagnostics
    ClusterId(0x0037), // Ethernet Network Diagnostics
    ClusterId(0x0038), // Time Synchronization
    ClusterId(0x0039), // Bridged Device Basic Information
    ClusterId(0x0040), // Fixed Label
    ClusterId(0x0041), // User Label
    ClusterId(0x003c), // Administrator Commissioning
    ClusterId(0x003e), // Node Operational Credentials
    ClusterId(0x003f), // Group Key Management
    ClusterId(0x0046), // ICD Management
    ClusterId(0x0062), // Scenes Management
];

export type NodeDetails = {
    manufacturer?: string;
    model?: string;
    color?: string;
    backgroundColor?: string;
};

export class GeneralMatterNode {
    readonly nodeId: string;
    readonly nodeBaseId: string;
    readonly connectionStateId: string;
    readonly connectionStatusId: string;
    readonly connectedAddressStateId: string;
    exposeMatterApplicationClusterData: boolean;
    exposeMatterSystemClusterData: boolean;
    #endpointMap = new Map<number, { baseId: string; endpoint: Endpoint }>();
    #deviceMap = new Map<number, GenericDeviceToIoBroker>();
    #attributeTypeMap = new Map<string, ioBroker.CommonType>();
    #eventMap = new Set<string>();
    #subscriptions = new Map<string, SubscribeCallback>();
    #name?: string;
    #details: NodeDetails = {};
    #connectedAddress?: string;
    #hasAggregatorEndpoint = false;
    #enabled = true;

    constructor(
        protected readonly adapter: MatterAdapter,
        readonly node: PairedNode,
        controllerConfig: MatterControllerConfig,
    ) {
        this.nodeId = node.nodeId.toString();
        this.nodeBaseId = `controller.${this.nodeId}`;
        this.connectionStateId = `${this.nodeBaseId}.info.connection`;
        this.connectionStatusId = `${this.nodeBaseId}.info.status`;
        this.connectedAddressStateId = `${this.nodeBaseId}.info.connectedAddress`;
        this.exposeMatterApplicationClusterData = controllerConfig.defaultExposeMatterApplicationClusterData ?? false;
        this.exposeMatterSystemClusterData = controllerConfig.defaultExposeMatterSystemClusterData ?? false;
    }

    async clear(): Promise<void> {
        // Clear out all things from before
        for (const [id, handler] of this.#subscriptions) {
            await SubscribeManager.unsubscribe(`${this.adapter.namespace}.${id}`, handler);
        }
        this.#subscriptions.clear();

        for (const device of this.#deviceMap.values()) {
            await device.destroy();
        }
        this.#deviceMap.clear();

        this.#endpointMap.clear();
        this.#attributeTypeMap.clear();
        this.#eventMap.clear();
    }

    get devices(): Map<number, GenericDeviceToIoBroker> {
        return this.#deviceMap;
    }

    get hasAggregatorEndpoint(): boolean {
        return this.#hasAggregatorEndpoint;
    }

    connect(connectOptions?: CommissioningControllerNodeOptions): void {
        if (!this.#enabled) {
            this.adapter.log.warn(`Node "${this.node.nodeId}" is disabled, so do not connect`);
            return;
        }
        this.node.connect(connectOptions);
    }

    async initialize(nodeDetails?: { operationalAddress?: string }): Promise<void> {
        await this.clear();

        const rootEndpoint = this.node.getRootEndpoint();
        if (rootEndpoint === undefined) {
            this.adapter.log.warn(`Node "${this.node.nodeId}" has not yet been initialized! Should not happen`);
            return;
        }

        const existingObject = await this.adapter.getObjectAsync(this.nodeBaseId);
        if (existingObject) {
            if (existingObject.native?.exposeMatterApplicationClusterData !== undefined) {
                this.exposeMatterApplicationClusterData = existingObject.native.exposeMatterApplicationClusterData;
            }
            if (existingObject.native?.exposeMatterSystemClusterData !== undefined) {
                this.exposeMatterSystemClusterData = existingObject.native.exposeMatterSystemClusterData;
            }
            if (existingObject.native?.enabled !== undefined) {
                this.#enabled = existingObject.native.enabled;
            }
        }
        // create device
        const deviceObj: ioBroker.Object = {
            _id: this.nodeBaseId,
            type: 'folder',
            common: {
                name: this.nodeId,
                statusStates: {
                    onlineId: `${this.adapter.namespace}.${this.connectionStateId}`,
                },
            },
            native: {
                nodeId: this.nodeId,
                exposeMatterApplicationClusterData: this.exposeMatterApplicationClusterData,
                exposeMatterSystemClusterData: this.exposeMatterSystemClusterData,
            },
        };

        const info = this.node.getRootClusterClient(BasicInformationCluster);
        if (info !== undefined) {
            this.#details = {
                manufacturer: await info.getVendorNameAttribute(),
                model: toHex(await info.getProductIdAttribute()),
            };

            if (existingObject && existingObject.common.name) {
                deviceObj.common.name = existingObject.common.name;
            } else {
                deviceObj.common.name = await info.getProductNameAttribute();
            }
            deviceObj.native.vendorId = toHex(await info.getVendorIdAttribute());
            deviceObj.native.vendorName = this.#details.manufacturer;
            deviceObj.native.productId = this.#details.model;
            deviceObj.native.nodeLabel = await info.getNodeLabelAttribute();
            deviceObj.native.productLabel = info.isAttributeSupportedByName('productLabel')
                ? await info.getProductLabelAttribute()
                : undefined;
            deviceObj.native.serialNumber = info.isAttributeSupportedByName('serialNumber')
                ? await info.getSerialNumberAttribute()
                : undefined;
        }
        this.#name = (deviceObj.common.name || this.nodeId) as string;

        await this.adapter.extendObjectAsync(deviceObj._id, deviceObj);

        await this.adapter.setObjectNotExists(`${this.nodeBaseId}.info`, {
            type: 'channel',
            common: {
                name: 'Node connection info',
            },
            native: {},
        });

        await this.adapter.setObjectNotExists(this.connectionStateId, {
            type: 'state',
            common: {
                name: 'Connected',
                role: 'indicator.connected',
                type: 'boolean',
                read: true,
                write: false,
            },
            native: {},
        });

        await this.adapter.setObjectNotExists(this.connectionStatusId, {
            type: 'state',
            common: {
                name: 'Connection status',
                role: 'state',
                type: 'number',
                states: {
                    [NodeStates.Connected]: 'connected',
                    [NodeStates.Disconnected]: 'disconnected',
                    [NodeStates.Reconnecting]: 'reconnecting',
                    [NodeStates.WaitingForDeviceDiscovery]: 'waitingForDeviceDiscovery',
                },
                read: true,
                write: false,
            },
            native: {},
        });

        await this.adapter.setObjectNotExists(this.connectedAddressStateId, {
            type: 'state',
            common: {
                name: 'Connected Address',
                role: 'info.ip',
                type: 'string',
                read: true,
                write: false,
            },
            native: {},
        });

        await this.adapter.setState(this.connectionStateId, this.node.isConnected, true);
        await this.adapter.setState(this.connectionStatusId, this.node.state, true);

        this.#connectedAddress = nodeDetails?.operationalAddress?.substring(6);
        await this.adapter.setState(this.connectedAddressStateId, this.#connectedAddress ?? null, true);

        await this.#processRootEndpointStructure(rootEndpoint, {
            endpointBaseName: deviceObj.native.nodeLabel || deviceObj.common.name,
        });
    }

    get isConnected(): boolean {
        return this.node.isConnected;
    }

    get isEnabled(): boolean {
        return this.#enabled;
    }

    async setEnabled(enabled: boolean): Promise<void> {
        if (enabled === this.#enabled) {
            return;
        }
        try {
            if (enabled) {
                this.node.connect();
            } else {
                await this.node.disconnect();
            }
            await this.adapter.extendObjectAsync(this.nodeBaseId, {
                native: {
                    enabled,
                },
            });
        } catch (error) {
            this.adapter.log.error(`Error while ${enabled ? 'enabling' : 'disabling'} node: ${error}`);
            return;
        }
        this.#enabled = enabled;
    }

    get name(): string {
        return this.#name || this.nodeId;
    }

    get details(): NodeDetails {
        return this.#details;
    }

    async applyConfiguration(config: PairedNodeConfig, forcedUpdate = false): Promise<void> {
        if (
            !forcedUpdate &&
            config.exposeMatterApplicationClusterData === this.exposeMatterApplicationClusterData &&
            config.exposeMatterSystemClusterData === this.exposeMatterSystemClusterData
        ) {
            return;
        }
        this.exposeMatterApplicationClusterData = config.exposeMatterApplicationClusterData;
        this.exposeMatterSystemClusterData = config.exposeMatterSystemClusterData;

        const rootEndpoint = this.node.getRootEndpoint();
        if (rootEndpoint === undefined) {
            this.adapter.log.warn(`Node "${this.node.nodeId}" has not yet been initialized! Should not not happen`);
            return;
        }

        await this.clear();
        return this.#processRootEndpointStructure(rootEndpoint);
    }

    // On Root level we create devices for all endpoints because these are devices
    async #processRootEndpointStructure(
        rootEndpoint: Endpoint,
        options?: {
            endpointBaseName?: string;
        },
    ): Promise<void> {
        await this.#endpointToIoBrokerDevices(rootEndpoint, rootEndpoint, this.nodeBaseId, options);

        for (const childEndpoint of rootEndpoint.getChildEndpoints()) {
            await this.#endpointToIoBrokerDevices(childEndpoint, rootEndpoint, this.nodeBaseId, options);
        }
    }

    async #endpointToIoBrokerDevices(
        endpoint: Endpoint,
        rootEndpoint: Endpoint,
        baseId: string,
        options?: {
            exposeMatterSystemClusterData?: boolean;
            exposeMatterApplicationClusterData?: boolean;
            connectionStateId?: string;
            endpointBaseName?: string;
        },
    ): Promise<void> {
        const id = endpoint.number;
        if (id === undefined) {
            this.adapter.log.warn(`Node ${this.node.nodeId}: Endpoint ${endpoint.name} has no number!`);
            return;
        }

        const { appTypes, primaryDeviceType } = identifyDeviceTypes(endpoint);
        if (appTypes.length > 1) {
            this.adapter.log.info(
                `Node ${this.node.nodeId}: Multiple device types detected: ${appTypes.map(t => t.deviceType.name).join(', ')}`,
            );
        }

        const deviceTypeName = primaryDeviceType?.deviceType.name ?? endpoint.name ?? 'Unknown';

        this.adapter.log.info(
            `Node ${this.node.nodeId}: Endpoint ${id} to ioBroker Devices ${endpoint.name} / ${deviceTypeName}`,
        );

        const endpointDeviceBaseId = `${baseId}.${deviceTypeName}-${id}`;

        // Only the global setting is relevant for the root endpoint
        if (id === 0 && !this.exposeMatterSystemClusterData) {
            await this.adapter.delObjectAsync(endpointDeviceBaseId, { recursive: true });
            return;
        }

        const existingObject = await this.adapter.getObjectAsync(endpointDeviceBaseId);
        const customExposeMatterSystemClusterData =
            existingObject?.native?.exposeMatterSystemClusterData ?? options?.exposeMatterSystemClusterData;
        let customExposeMatterApplicationClusterData =
            existingObject?.native?.exposeMatterApplicationClusterData ?? options?.exposeMatterApplicationClusterData;
        let exposeMatterApplicationClusterData =
            customExposeMatterApplicationClusterData ?? this.exposeMatterApplicationClusterData;

        let connectionStateId = options?.connectionStateId ?? `${this.adapter.namespace}.${this.connectionStateId}`;

        // TODO: Add TagList support
        const bridgedBasicInfo = endpoint.getClusterClient(BridgedDeviceBasicInformation.Cluster);
        const endpointName = bridgedBasicInfo?.isAttributeSupportedByName('nodeLabel')
            ? await bridgedBasicInfo.getNodeLabelAttribute()
            : `${deviceTypeName}-${id}`;
        const endpointBaseName =
            primaryDeviceType?.deviceType.id === AggregatorEndpointDefinition.deviceType
                ? options?.endpointBaseName
                : options?.endpointBaseName
                  ? `${options?.endpointBaseName} - ${endpointName ?? '???'}`
                  : (endpointName ?? '???');

        if (primaryDeviceType === undefined) {
            this.adapter.log.warn(
                `Node ${this.node.nodeId}: Unknown device type: ${serialize(endpoint.deviceType)}. Please report this issue.`,
            );
        } else if (
            primaryDeviceType.deviceType.id === AggregatorEndpointDefinition.deviceType ||
            primaryDeviceType.deviceType.id === BridgedNodeEndpointDefinition.deviceType
        ) {
            // An Aggregator device type has a slightly different structure
            this.#hasAggregatorEndpoint = true;
            this.adapter.log.info(
                `Node ${this.node.nodeId}: ${primaryDeviceType.deviceType.name} device type detected`,
            );
            await this.adapter.extendObjectAsync(endpointDeviceBaseId, {
                type: 'folder',
                common: {
                    name: existingObject
                        ? undefined
                        : primaryDeviceType?.deviceType.id === AggregatorEndpointDefinition.deviceType
                          ? options?.endpointBaseName
                              ? `${options?.endpointBaseName} - ${deviceTypeName}-${id}`
                              : `${deviceTypeName}-${id}`
                          : endpointBaseName,
                },
                native: {
                    nodeId: this.nodeId,
                    endpointId: id,
                },
            });

            if (primaryDeviceType.deviceType.name === 'BridgedNode') {
                const ioBrokerDevice = await ioBrokerDeviceFabric(
                    this.node,
                    endpoint,
                    rootEndpoint,
                    this.adapter,
                    endpointDeviceBaseId,
                    connectionStateId,
                    endpointBaseName ?? endpoint.name,
                );
                if (ioBrokerDevice !== null) {
                    connectionStateId = ioBrokerDevice.connectionStateId;
                    this.#deviceMap.set(id, ioBrokerDevice);
                }
            }

            for (const childEndpoint of endpoint.getChildEndpoints()) {
                // Recursive call to process all sub endpoints for raw states
                await this.#endpointToIoBrokerDevices(childEndpoint, rootEndpoint, endpointDeviceBaseId, {
                    connectionStateId,
                    endpointBaseName,
                });
            }
        } else {
            await this.adapter.extendObjectAsync(endpointDeviceBaseId, {
                type: 'device',
                common: {
                    name: existingObject ? undefined : endpointBaseName,
                },
                native: {
                    nodeId: this.nodeId,
                    endpointId: id,
                },
            });

            if (id !== 0) {
                // Ignore the root endpoint
                const ioBrokerDevice = await ioBrokerDeviceFabric(
                    this.node,
                    endpoint,
                    rootEndpoint,
                    this.adapter,
                    endpointDeviceBaseId,
                    connectionStateId,
                    endpointBaseName ?? endpoint.name,
                );
                if (ioBrokerDevice !== null) {
                    this.#deviceMap.set(id, ioBrokerDevice);
                } else {
                    // We expose the matter application data on the endpoint level
                    if (!exposeMatterApplicationClusterData) {
                        exposeMatterApplicationClusterData = true;
                        customExposeMatterApplicationClusterData = true;

                        await this.adapter.extendObjectAsync(endpointDeviceBaseId, {
                            native: {
                                exposeMatterApplicationClusterData,
                            },
                        });
                    }
                }
            }
        }

        await this.#processEndpointRawDataStructure(endpoint, endpointDeviceBaseId, {
            exposeMatterSystemClusterData: customExposeMatterSystemClusterData,
            exposeMatterApplicationClusterData: customExposeMatterApplicationClusterData,
        });
    }

    async #processEndpointRawDataStructure(
        endpoint: Endpoint,
        endpointDeviceBaseId: string,
        options?: {
            exposeMatterSystemClusterData?: boolean;
            exposeMatterApplicationClusterData?: boolean;
        },
        path?: number[],
    ): Promise<void> {
        this.adapter.log.info(`${''.padStart((path?.length ?? 0) * 2)}Endpoint ${endpoint.number} (${endpoint.name}):`);

        const exposeMatterSystemClusterData =
            options?.exposeMatterSystemClusterData ?? this.exposeMatterSystemClusterData;
        const exposeMatterApplicationClusterData =
            options?.exposeMatterApplicationClusterData ?? this.exposeMatterApplicationClusterData;

        const id = endpoint.number;
        if (id === undefined) {
            this.adapter.log.warn(`Node ${this.node.nodeId}: Endpoint ${endpoint.name} has no number!`);
            return;
        }
        const endpointPath = path === undefined ? [id] : [...path, id];

        const endpointDeviceBaseDataId = `${endpointDeviceBaseId}.data`;
        if ((id === 0 && !exposeMatterSystemClusterData) || (id !== 0 && !exposeMatterApplicationClusterData)) {
            await this.adapter.delObjectAsync(endpointDeviceBaseDataId, { recursive: true });
            return;
        }

        await this.adapter.setObjectNotExists(endpointDeviceBaseDataId, {
            type: 'folder',
            common: {
                name: `Raw endpoint ${id} data`,
            },
            native: {},
        });

        await this.initializeEndpointRawDataStates(endpoint, endpointDeviceBaseDataId, options, endpointPath.join('-'));

        if (id !== 0) {
            for (const childEndpoint of endpoint.getChildEndpoints()) {
                // Recursive call to process all sub endpoints for raw states
                await this.#processEndpointRawDataStructure(
                    childEndpoint,
                    endpointDeviceBaseDataId,
                    options,
                    endpointPath,
                );
            }
        }
    }

    #getAttributeMapId(endpointId: number, clusterId: number, attributeId: number): string {
        return `${endpointId}.${clusterId}.${attributeId}`;
    }

    #getEventMapId(endpointId: number, clusterId: number, eventId: number): string {
        return `${endpointId}.${clusterId}.${eventId}`;
    }

    #determineIoBrokerDatatype(
        endpointId: number,
        clusterId: number,
        attributeId: number,
        isUnknown: boolean,
    ): { type: ioBroker.CommonType; states?: Record<number, string> } {
        const knownType = this.#attributeTypeMap.get(this.#getAttributeMapId(endpointId, clusterId, attributeId));
        if (knownType !== undefined) {
            return { type: knownType };
        }

        let type: ioBroker.CommonType;
        const states: Record<number, string> = {};
        if (isUnknown) {
            type = 'mixed';
        } else {
            const attributeModel = MatterModel.standard.get(ClusterModel, clusterId)?.get(AttributeModel, attributeId);
            const effectiveType = attributeModel?.effectiveType;
            const metatype = attributeModel?.effectiveMetatype;
            if (metatype === undefined) {
                type = 'mixed';
            } else if (metatype.startsWith('int') || metatype.startsWith('uint')) {
                if (metatype.endsWith('64')) {
                    type = 'string';
                } else {
                    type = 'number';
                }
            } else if (metatype.startsWith('enum')) {
                type = 'number';
                attributeModel?.members.forEach(member => {
                    if (member.id === undefined || member.name === undefined) {
                        return;
                    }
                    states[member.id] = member.name;
                });
            } else if (effectiveType === 'bool') {
                type = 'boolean';
            } else if (effectiveType === 'string') {
                type = 'string';
            } else {
                type = 'object';
            }
        }
        this.#attributeTypeMap.set(this.#getAttributeMapId(endpointId, clusterId, attributeId), type);
        return { type, states: Object.keys(states).length > 0 ? states : undefined };
    }

    async initializeEndpointRawDataStates(
        endpoint: Endpoint,
        endpointDeviceBaseDataId: string,
        options:
            | {
                  exposeMatterSystemClusterData?: boolean;
                  exposeMatterApplicationClusterData?: boolean;
              }
            | undefined,
        path: string,
    ): Promise<void> {
        if (endpoint.number === undefined) {
            this.adapter.log.warn(`Node ${this.node.nodeId}: Endpoint ${endpoint.name} has no number!`);
            return;
        }
        const endpointBaseId = `${endpointDeviceBaseDataId}.${path}`;

        const exposeMatterSystemClusterData =
            options?.exposeMatterSystemClusterData ?? this.exposeMatterSystemClusterData;

        this.#endpointMap.set(endpoint.number, { baseId: endpointBaseId, endpoint });

        await this.adapter.setObjectNotExists(endpointBaseId, {
            type: 'folder',
            common: {
                name: path,
            },
            native: {},
        });

        // Ignore ClusterServers for now
        // Process ClusterClients
        const clusters = endpoint.getAllClusterClients();
        for (const clusterClient of clusters) {
            const clusterId = clusterClient.id;
            // TODO make Configurable
            const clusterBaseId = `${endpointBaseId}.${toHex(clusterId)}`;
            if (!exposeMatterSystemClusterData && SystemClusters.includes(clusterId)) {
                await this.adapter.delObjectAsync(clusterBaseId, { recursive: true });
                continue;
            }

            await this.adapter.setObjectNotExists(clusterBaseId, {
                type: 'folder',
                common: {
                    name: clusterClient.name,
                },
                native: {
                    nodeId: this.nodeId,
                    endpointId: endpoint.number,
                    clusterId,
                },
            });

            const { supportedFeatures: features } = clusterClient;
            const globalAttributes = GlobalAttributes<any>(features);
            const supportedFeatures = new Array<string>();
            for (const featureName in features) {
                if (features[featureName] === true) {
                    supportedFeatures.push(featureName);
                }
            }
            await this.adapter.setObjectNotExists(`${clusterBaseId}.supportedFeatures`, {
                type: 'state',
                common: {
                    name: 'Supported Features',
                    role: 'state',
                    type: 'string',
                    read: true,
                    write: false,
                },
                native: {},
            });
            await this.adapter.setState(`${clusterBaseId}.supportedFeatures`, supportedFeatures.join(', '), true);

            const attributes = clusterClient.attributes;
            let addedAttributes = 0;
            for (const attributeName in attributes) {
                const attribute = attributes[attributeName];
                if (attribute === undefined) {
                    continue;
                }
                if (!(attribute instanceof SupportedAttributeClient)) {
                    continue;
                }
                // TODO make Configurable
                if (attributeName in globalAttributes) {
                    continue;
                }
                const unknown = attribute instanceof UnknownSupportedAttributeClient;
                const attributeBaseId = `${clusterBaseId}.attributes.${attribute.name.replace('unknownAttribute_', '')}`;

                const { type: targetType, states: targetStates } = this.#determineIoBrokerDatatype(
                    endpoint.number,
                    attribute.clusterId,
                    attribute.id,
                    unknown,
                );
                await this.adapter.extendObjectAsync(attributeBaseId, {
                    type: 'state',
                    common: {
                        name: attribute.name,
                        role: 'state',
                        type: targetType,
                        read: true,
                        write: attribute.attribute.writable,
                        states: targetStates,
                    },
                    native: {},
                });
                addedAttributes++;

                if (this.node.isConnected) {
                    // Only request values when connected, else old values should still be current
                    try {
                        const attributeValue = await attribute.get(false); // Only use locally cached values, do not request from remote
                        await this.adapter.setState(
                            attributeBaseId,
                            this.#formatAttributeServerValue(endpoint.number, attributeValue, targetType),
                            true,
                        );
                    } catch (error: unknown) {
                        if (error instanceof FabricScopeError) {
                            this.adapter.log.warn('Fabric-Scoped');
                        } else {
                            this.adapter.log.warn(`Error: ${(error as Error).message}`);
                        }
                    }
                }

                if (attribute.attribute.writable) {
                    const handler: SubscribeCallback = async state => {
                        if (!state || state.ack) {
                            return;
                        } // Only controls are processed
                        try {
                            await attribute.set(state.val);
                        } catch (e: unknown) {
                            this.adapter.log.warn(`Error: ${(e as Error).message}`);
                        }
                    };
                    this.#subscriptions.set(attributeBaseId, handler);
                    await SubscribeManager.subscribe(`${this.adapter.namespace}.${attributeBaseId}`, handler);
                }
            }
            if (addedAttributes > 0) {
                await this.adapter.setObjectNotExists(`${clusterBaseId}.attributes`, {
                    type: 'folder',
                    common: {
                        name: 'Attributes',
                    },
                    native: {},
                });
            }

            let addedEvents = 0;
            const events = clusterClient.events;
            for (const eventName in events) {
                const event = events[eventName];
                if (event === undefined) {
                    continue;
                }
                const eventBaseId = `${clusterBaseId}.events.${event.name}`;

                this.#eventMap.add(this.#getEventMapId(endpoint.number, event.clusterId, event.id));
                await this.adapter.extendObjectAsync(eventBaseId, {
                    type: 'state',
                    common: {
                        name: event.name,
                        role: 'state',
                        type: 'object',
                        read: true,
                        write: false,
                    },
                    native: {},
                });
                addedEvents++;
            }
            if (addedEvents > 0) {
                await this.adapter.setObjectNotExists(`${clusterBaseId}.events`, {
                    type: 'folder',
                    common: {
                        name: 'Events',
                    },
                    native: {},
                });
            }

            let addedCommands = 0;
            const commands = clusterClient.commands;
            for (const commandName in commands) {
                if (!clusterClient.isCommandSupportedByName(commandName)) {
                    continue;
                }
                const command = commands[commandName];
                if (command === undefined) {
                    continue;
                }
                const commandBaseId = `${clusterBaseId}.commands.${commandName}`;

                const commandModel = MatterModel.standard
                    .get(ClusterModel, clusterId)
                    ?.get(CommandModel, capitalize(commandName));
                if (!commandModel) {
                    continue;
                }

                const hasArguments = commandModel.children?.length > 0;

                await this.adapter.extendObjectAsync(commandBaseId, {
                    type: 'state',
                    common: {
                        name: command.name,
                        role: hasArguments ? 'json' : 'button',
                        type: hasArguments ? 'string' : 'boolean',
                        read: false,
                        write: true,
                    },
                    native: {},
                });

                const handler: SubscribeCallback = async state => {
                    // Only controls are processed
                    if (!state || state.ack) {
                        return;
                    }

                    let parsedValue: any;
                    if (hasArguments) {
                        try {
                            parsedValue = JSON.parse(state.val as string);
                        } catch {
                            try {
                                parsedValue = JSON.parse(`"${state.val}"`);
                            } catch {
                                this.adapter.log.info(
                                    `Node ${this.node.nodeId}: ERROR: Could not parse value ${state.val} as JSON.`,
                                );
                                return;
                            }
                        }
                    } else {
                        parsedValue = undefined;
                    }

                    try {
                        await command(parsedValue, {
                            asTimedRequest: commandModel.effectiveAccess.timed,
                        });
                    } catch (e: unknown) {
                        this.adapter.log.warn(`Node ${this.node.nodeId}: Error: ${(e as Error).message}`);
                    }
                };
                this.#subscriptions.set(commandBaseId, handler);
                await SubscribeManager.subscribe(`${this.adapter.namespace}.${commandBaseId}`, handler);
                addedCommands++;
            }
            if (addedCommands > 0) {
                await this.adapter.setObjectNotExists(`${clusterBaseId}.commands`, {
                    type: 'folder',
                    common: {
                        name: 'Commands',
                    },
                    native: {},
                });
            }
        }
    }

    async handleChangedAttribute(data: DecodedAttributeReportValue<any>): Promise<void> {
        const {
            path: { nodeId, clusterId, endpointId, attributeId, attributeName },
            value,
        } = data;
        this.adapter.log.debug(
            `handleChangedAttribute "${this.nodeId}": Attribute ${nodeId}/${endpointId}/${toHex(clusterId)}/${attributeName} changed to ${Logger.toJSON(
                value,
            )}`,
        );

        if (endpointId === 0) {
            for (const device of this.#deviceMap.values()) {
                try {
                    await device.handleChangedAttribute({ clusterId, endpointId, attributeId, attributeName, value });
                } catch (error) {
                    this.adapter.log.warn(`Failed to set changed attribute: ${error.message}`);
                }
            }
        } else {
            const device = this.#deviceMap.get(endpointId);
            if (device !== undefined) {
                try {
                    await device.handleChangedAttribute({ clusterId, endpointId, attributeId, attributeName, value });
                } catch (error) {
                    this.adapter.log.warn(`Failed to set changed attribute: ${error.message}`);
                }
            }
        }

        const targetType = this.#attributeTypeMap.get(this.#getAttributeMapId(endpointId, clusterId, attributeId));
        const endpointBaseId = this.#endpointMap.get(endpointId)?.baseId;
        if (targetType === undefined || endpointBaseId === undefined) {
            return;
        }
        await this.adapter.setState(
            `${endpointBaseId}.${toHex(clusterId)}.attributes.${attributeName.replace('unknownAttribute_', '')}`,
            this.#formatAttributeServerValue(endpointId, value, targetType),
            true,
        );
    }

    async handleTriggeredEvent(data: DecodedEventReportValue<any>): Promise<void> {
        const {
            path: { nodeId, clusterId, endpointId, eventId, eventName },
            events,
        } = data;
        this.adapter.log.debug(
            `handleTriggeredEvent "${this.nodeId}": Event ${nodeId}/${endpointId}/${toHex(clusterId)}/${eventName} triggered with ${Logger.toJSON(
                events,
            )}`,
        );

        if (endpointId === 0) {
            for (const device of this.#deviceMap.values()) {
                await device.handleTriggeredEvent({ clusterId, endpointId, eventId, eventName, events });
            }
        } else {
            const device = this.#deviceMap.get(endpointId);
            if (device !== undefined) {
                await device.handleTriggeredEvent({ clusterId, endpointId, eventId, eventName, events });
            }
        }

        if (!this.#eventMap.has(this.#getEventMapId(endpointId, clusterId, eventId))) {
            return;
        }
        const endpointBaseId = this.#endpointMap.get(endpointId)?.baseId;
        if (endpointBaseId === undefined) {
            return;
        }
        await this.adapter.setState(
            `${endpointBaseId}.${toHex(clusterId)}.events.${eventName}`,
            Logger.toJSON(events),
            true,
        );
    }

    async handleStateChange(state: NodeStates, nodeDetails?: { operationalAddress?: string }): Promise<void> {
        const connected = state === NodeStates.Connected;
        await this.adapter.setState(this.connectionStateId, connected, true);
        await this.adapter.setState(this.connectionStatusId, state, true);
        if (connected && nodeDetails) {
            this.#connectedAddress = nodeDetails.operationalAddress?.substring(6);
            await this.adapter.setState(this.connectedAddressStateId, this.#connectedAddress ?? null, true);
        }

        switch (state) {
            case NodeStates.Connected:
                this.adapter.log.info(`Node "${this.nodeId}" connected`);
                break;
            case NodeStates.Disconnected:
                this.adapter.log.info(`Node "${this.nodeId}" disconnected`);
                break;
            case NodeStates.Reconnecting:
                this.adapter.log.info(`Node "${this.nodeId}" reconnecting`);
                break;
            case NodeStates.WaitingForDeviceDiscovery:
                this.adapter.log.info(`Node "${this.nodeId}" offline, waiting for device discovery`);
                break;
        }
    }

    #formatAttributeServerValue(_endpointId: number, attributeValue: any, targetType: ioBroker.CommonType): string {
        let value: any;
        if (attributeValue === null || attributeValue === undefined) {
            value = null;
        } else if (targetType === 'object') {
            value = Logger.toJSON(attributeValue);
        } else if (targetType === 'number') {
            if (typeof attributeValue === 'number') {
                value = attributeValue;
            } else {
                value = 'NaN';
            }
        } else if (targetType === 'boolean') {
            value = !!attributeValue;
        } else if (targetType === 'string') {
            value = attributeValue.toString();
        } else {
            if (typeof attributeValue === 'object') {
                value = Logger.toJSON(attributeValue);
            } else {
                value = attributeValue;
            }
        }
        return value;
    }

    async destroy(): Promise<void> {
        await this.adapter.setState(this.connectionStateId, false, true);
        await this.adapter.setState(this.connectionStatusId, NodeStates.Disconnected, true);
        await this.clear();
    }

    async remove(): Promise<void> {
        if (this.adapter.controllerNode === undefined) {
            throw new Error('Controller seems not to be initialized ... can not unpair device!');
        }
        await this.adapter.controllerNode.decommissionNode(this.nodeId);
        await this.clear();
        this.adapter.log.info(`Node "${this.nodeId}" removed. Removing Storage in ${this.nodeBaseId}`);
        await this.adapter.delObjectAsync(this.nodeBaseId, { recursive: true });
    }

    async rename(newName: string): Promise<void> {
        this.#name = newName;
        await this.adapter.extendObjectAsync(this.nodeBaseId, { common: { name: newName } });
    }

    async getNodeDetails(): Promise<StructuredJsonFormData> {
        const result: StructuredJsonFormData = {};

        const details = this.node.basicInformation;

        if (details) {
            result.node = {};

            result.node.vendorName = details.vendorName;
            result.node.vendorId = toHex(details.vendorId as number);
            result.node.productName = details.productName;
            result.node.productId = toHex(details.productId as number);
            result.node.nodeLabel = details.nodeLabel;
            result.node.location = details.location;
            result.node.hardwareVersion = details.hardwareVersionString;
            result.node.softwareVersion = details.softwareVersionString;
            if (details.productUrl) {
                result.node.productUrl = details.productUrl;
            }
            if (details.serialNumber) {
                result.node.serialNumber = details.serialNumber;
            }
            if (details.uniqueId) {
                result.node.uniqueId = details.uniqueId;
            }

            result.capabilities = {
                ...this.node.deviceInformation,

                // hide these two entries
                dataRevision: undefined,
                rootEndpointServerList: undefined,
            };

            if (this.node.isConnected) {
                result.network = {
                    connectedAddress: this.#connectedAddress,
                };
                const generalDiag = this.node.getRootClusterClient(GeneralDiagnosticsCluster);
                if (generalDiag) {
                    try {
                        const networkInterfaces = await generalDiag.getNetworkInterfacesAttribute();
                        if (networkInterfaces) {
                            const interfaces = networkInterfaces.filter(({ isOperational }) => isOperational);
                            if (interfaces.length) {
                                interfaces.forEach(({ name, hardwareAddress, iPv4Addresses, iPv6Addresses }, index) => {
                                    result.network[`__header__${index}_${name}`] = `Interface ${index} "${name}"`;
                                    result.network[`${index}_${name}__HardwareAddress`] = bytesToMac(hardwareAddress);
                                    result.network[`${index}_${name}__IPv4Addresses`] = iPv4Addresses
                                        .map(ip => bytesToIpV4(ip))
                                        .join(', ');
                                    result.network[`${index}_${name}__IPv6Addresses`] = iPv6Addresses
                                        .map(ip => bytesToIpV6(ip))
                                        .join(', ');
                                });
                            }
                        }
                    } catch (e) {
                        this.adapter.log.info(`Failed to get network interfaces: ${e}`);
                    }
                }
            }

            result.specification = {};
            if (details.dataModelVersion) {
                result.specification.dataModelVersion = details.dataModelVersion;
            }
            if (typeof details.specificationVersion === 'number') {
                result.specification.specificationVersion = SpecificationVersion.decode(details.specificationVersion);
            } else if (details.specificationVersion === undefined) {
                result.specification.specificationVersion = '< 1.3.0';
            } else {
                result.specification.specificationVersion = details.specificationVersion;
            }
            if (details.maxPathsPerInvoke) {
                result.specification.maxPathsPerInvoke = details.maxPathsPerInvoke;
            }
            result.specification.capabilityMinima = JSON.stringify(details.capabilityMinima);
        }

        const rootEndpoint = this.node.getRootEndpoint();
        if (rootEndpoint) {
            result.rootEndpointClusters = {} as Record<string, unknown>;
            for (const client of rootEndpoint.getAllClusterClients()) {
                const activeFeatures = new Array<string>();
                Object.keys(client.supportedFeatures).forEach(
                    f => client.supportedFeatures[f] && activeFeatures.push(f),
                );
                result.rootEndpointClusters[`__header__${client.name}`] = decamelize(client.name);
                result.rootEndpointClusters[`${client.name}__Features`] = activeFeatures.length
                    ? activeFeatures.map(name => decamelize(name)).join(', ')
                    : 'Basic features set';
                result.rootEndpointClusters[`${client.name}__Revision`] = client.revision;
            }
        }

        return result;
    }

    async getStatus(): Promise<DeviceStatus> {
        const status: DeviceStatus = {
            connection:
                this.node.isConnected || this.node.state === NodeStates.Reconnecting ? 'connected' : 'disconnected',
        };

        if (this.node.state === NodeStates.Reconnecting) {
            status.warning = 'The Node is currently reconnecting ...';
        }

        if (this.node.isConnected) {
            const wifiNetworkDiagnostics = this.node.getRootClusterClient(WiFiNetworkDiagnosticsCluster);
            if (wifiNetworkDiagnostics !== undefined && wifiNetworkDiagnostics.isAttributeSupportedByName('rssi')) {
                const rssi = await wifiNetworkDiagnostics.getRssiAttribute(false);
                if (rssi !== null) {
                    status.rssi = rssi;
                }
            }
        }

        return status;
    }

    get connectionType(): ConfigConnectionType {
        if (this.node.deviceInformation?.threadConnected) {
            return 'thread';
        } else if (this.node.deviceInformation?.wifiConnected) {
            return 'wifi';
        } else if (this.node.deviceInformation?.ethernetConnected) {
            return 'lan';
        }
        return 'other';
    }

    async getConnectionStatus(): Promise<StructuredJsonFormData> {
        const result: StructuredJsonFormData = {};

        result.connection = {
            __text__connected: this.node.isConnected
                ? 'The node is successfully connected.'
                : this.#enabled
                  ? 'The node is currently not connected.'
                  : 'The node is disabled.',
            status: decamelize(NodeStates[this.node.state]),
        };

        if (this.node.isConnected) {
            result.connection.address = this.#connectedAddress;
            if (this.node.deviceInformation?.threadConnected) {
                result.connection.connectedVia = 'Thread';
            } else if (this.node.deviceInformation?.wifiConnected) {
                result.connection.connectedVia = 'WiFi';
            } else if (this.node.deviceInformation?.ethernetConnected) {
                result.connection.connectedVia = 'Ethernet';
            }

            const operationalCredentials = this.node.getRootClusterClient(OperationalCredentialsCluster);
            if (operationalCredentials) {
                //const ownFabricIndex = await operationalCredentials.getCurrentFabricIndexAttribute();
                const fabrics = await operationalCredentials.getFabricsAttribute(true, false);
                fabrics.forEach(fabric => {
                    const fabricId = fabric.fabricId;
                    const fabricName = `${fabric.vendorId}`;
                    result.connection[`fabric${fabricId}__${fabricName}`] = fabric.label;
                    // TODO Add name lookup and button to manage beside own Fabric index
                });
            }
        }

        return result;
    }
}
