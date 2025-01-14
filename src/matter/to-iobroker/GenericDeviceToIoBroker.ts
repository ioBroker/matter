import { type AttributeId, type ClusterId, Diagnostic, EndpointNumber, type EventId, MaybePromise } from '@matter/main';
import { BasicInformation, BridgedDeviceBasicInformation, Identify, PowerSource } from '@matter/main/clusters';
import type { DecodedEventData } from '@matter/main/protocol';
import type { Endpoint, PairedNode, DeviceBasicInformation } from '@project-chip/matter.js/device';
import type { GenericDevice } from '../../lib';
import { PropertyType } from '../../lib/devices/DeviceStateObject';
import type { DeviceOptions } from '../../lib/devices/GenericDevice';
import { decamelize, toHex } from '../../lib/utils';
import type { StructuredJsonFormData } from '../../lib/JsonConfigUtils';
import type { DeviceStatus } from '@iobroker/dm-utils';

export interface EnabledProperty {
    common?: Partial<ioBroker.StateCommon>;
    endpointId?: EndpointNumber;
    clusterId?: ClusterId;
}

export interface EnabledAttributeProperty extends EnabledProperty {
    type: 'attribute';
    attributeId?: AttributeId;
    attributeName?: string;
    convertValue?: (value: any) => MaybePromise<any>;
    changeHandler?: (value: any) => Promise<void> | void;
    pollAttribute?: boolean;
}

export interface EnabledEventProperty extends EnabledProperty {
    type: 'event';
    eventId?: EventId;
    eventName?: string;
    convertValue: (property: PropertyType, event: DecodedEventData<any>) => MaybePromise<any>;
}

export type GenericDeviceConfiguration = {
    pollInterval?: number;
};

function attributePathToString(path: {
    endpointId: EndpointNumber;
    clusterId: ClusterId;
    attributeName: string;
}): string {
    return `A:${path.endpointId}-${path.clusterId}-${path.attributeName}`;
}

function eventPathToString(path: { endpointId: EndpointNumber; clusterId: ClusterId; eventName: string }): string {
    return `E:${path.endpointId}-${path.clusterId}-${path.eventName}`;
}

/** Base class to map an ioBroker device to a matter device. */
export abstract class GenericDeviceToIoBroker {
    readonly #adapter: ioBroker.Adapter;
    readonly baseId: string;
    readonly #node: PairedNode;
    protected readonly appEndpoint: Endpoint;
    readonly #rootEndpoint: Endpoint;
    #name?: string;
    #defaultName: string;
    readonly deviceType: string;
    readonly #deviceOptions: DeviceOptions;
    #enabledAttributeProperties = new Map<PropertyType, EnabledAttributeProperty>();
    #enabledEventProperties = new Map<PropertyType, EnabledEventProperty[]>();
    #matterMappings = new Map<string, PropertyType | ((value: any) => MaybePromise<any>)>();
    #connectionStateId: string;
    #hasBridgedReachabilityAttribute = false;
    #pollTimeout?: NodeJS.Timeout;
    #destroyed = false;
    #initialized = false;
    #pollInterval = 60_000;
    #hasAttributesToPoll = false;

    protected constructor(
        adapter: ioBroker.Adapter,
        node: PairedNode,
        endpoint: Endpoint,
        rootEndpoint: Endpoint,
        endpointDeviceBaseId: string,
        deviceTypeName: string,
        defaultConnectionStateId: string,
        defaultName: string,
    ) {
        this.#adapter = adapter;
        this.#node = node;
        this.appEndpoint = endpoint;
        this.#rootEndpoint = rootEndpoint;
        this.baseId = endpointDeviceBaseId;
        this.#defaultName = defaultName;
        this.deviceType = deviceTypeName;
        this.#connectionStateId = defaultConnectionStateId;

        this.#deviceOptions = {
            additionalStateData: {},
            uuid: '',
            enabled: true,
            name: this.#name || deviceTypeName,
            oid: this.baseId,
            type: '...',
            auto: true,
            noComposed: true,
        };
    }

    /** Return the ioBroker device this mapping is for. */
    abstract ioBrokerDevice: GenericDevice;

    get ioBrokerDeviceType(): string | undefined {
        return this.ioBrokerDevice.deviceType;
    }

    get iconDeviceType(): string | undefined {
        return this.ioBrokerDevice.deviceType;
    }

    get name(): string {
        return this.#name ?? this.#defaultName ?? this.deviceType;
    }

    get number(): EndpointNumber {
        return this.appEndpoint.number!;
    }

    get connectionStateId(): string {
        return this.#connectionStateId;
    }

    get nodeBasicInformation(): Partial<DeviceBasicInformation> {
        return this.#node.basicInformation ?? {};
    }

    /**
     * Method to override to add own states to the device.
     * This method is called by the constructor.
     */
    protected enableDeviceTypeStates(): DeviceOptions {
        this.enableDeviceTypeStateForAttribute(PropertyType.Unreachable, {
            endpointId: EndpointNumber(0),
            clusterId: BasicInformation.Cluster.id,
            attributeName: 'reachable',
            convertValue: value => !value,
        });
        if (!this.#enabledAttributeProperties.has(PropertyType.Unreachable)) {
            this.enableDeviceTypeStateForAttribute(PropertyType.Unreachable, {
                endpointId: this.appEndpoint.number!,
                clusterId: BridgedDeviceBasicInformation.Cluster.id,
                attributeName: 'reachable',
                convertValue: value => !value,
            });
            if (this.#enabledAttributeProperties.has(PropertyType.Unreachable)) {
                this.#hasBridgedReachabilityAttribute = true;
            }
        }
        // Check for PowerSource
        this.#enablePowerSourceStates();

        return this.#deviceOptions;
    }

    #enablePowerSourceStates(): void {
        const powerSource = this.appEndpoint.getClusterClient(PowerSource.Complete);
        if (powerSource !== undefined) {
            const endpointId = this.appEndpoint.getNumber();
            this.enableDeviceTypeStateForAttribute(PropertyType.LowBattery, {
                endpointId,
                clusterId: PowerSource.Cluster.id,
                attributeName: 'batChargeLevel',
                convertValue: value => value !== PowerSource.BatChargeLevel.Ok,
            });
            this.enableDeviceTypeStateForAttribute(PropertyType.Battery, {
                endpointId,
                clusterId: PowerSource.Cluster.id,
                attributeName: 'batPercentRemaining',
                convertValue: value => Math.round(value / 2),
            });
        } else {
            const rootPowerSource = this.#rootEndpoint.getClusterClient(PowerSource.Complete);
            if (rootPowerSource !== undefined && rootPowerSource.supportedFeatures.battery) {
                this.enableDeviceTypeStateForAttribute(PropertyType.LowBattery, {
                    endpointId: EndpointNumber(0),
                    clusterId: PowerSource.Cluster.id,
                    attributeName: 'batChargeLevel',
                    convertValue: value => value !== PowerSource.BatChargeLevel.Ok,
                });
                this.enableDeviceTypeStateForAttribute(PropertyType.Battery, {
                    endpointId: EndpointNumber(0),
                    clusterId: PowerSource.Cluster.id,
                    attributeName: 'batPercentRemaining',
                    convertValue: value => Math.round(value / 2),
                });
            }
        }
    }

    protected registerStateChangeHandlerForAttribute(
        data: {
            endpointId: EndpointNumber;
            clusterId: ClusterId;
            matterValueChanged: (value: any) => MaybePromise<any>;
        } & ({ vendorSpecificAttributeId: AttributeId } | { attributeName?: string }),
    ): void {
        const { endpointId, clusterId, matterValueChanged } = data;
        const attributeName =
            'vendorSpecificAttributeId' in data
                ? `unknownAttribute_${Diagnostic.hex(data.vendorSpecificAttributeId)}`
                : data.attributeName;
        if (attributeName !== undefined) {
            const cluster =
                endpointId === 0
                    ? this.#rootEndpoint.getClusterClientById(clusterId)
                    : this.appEndpoint.getClusterClientById(clusterId);
            if (!cluster || !cluster.isAttributeSupportedByName(attributeName)) {
                return;
            }
        }

        if (attributeName === undefined) {
            this.#adapter.log.warn(
                `No attribute name cound be determined for change handler for ${endpointId}/${clusterId}`,
            );
            return;
        }
        const pathId = attributePathToString({ endpointId, clusterId, attributeName });
        this.#matterMappings.set(pathId, matterValueChanged);
    }

    /**
     * Enable a state for a Matter attribute if it exists and the property type is supported.
     * Important: provide attributeName for all standard Matter properties OR provide attributeId for vendor specific properties.
     */
    protected enableDeviceTypeStateForAttribute(
        type: PropertyType,
        data?: {
            endpointId?: EndpointNumber;
            clusterId?: ClusterId;
            convertValue?: (value: any) => MaybePromise<any>;
            changeHandler?: (value: any) => Promise<void> | void;
            pollAttribute?: boolean;
        } & ({ vendorSpecificAttributeId: AttributeId } | { attributeName?: string }),
    ): void {
        const stateData = this.#deviceOptions.additionalStateData![type] ?? {};
        if (stateData.id !== undefined) {
            console.log(`State ${type} already enabled`);
            return;
        }

        if (data !== undefined) {
            const { endpointId, clusterId, convertValue, changeHandler, pollAttribute } = data;
            let attributeId: AttributeId | undefined;
            const attributeName =
                'vendorSpecificAttributeId' in data
                    ? `unknownAttribute_${Diagnostic.hex(data.vendorSpecificAttributeId)}`
                    : data.attributeName;
            if (endpointId !== undefined && clusterId !== undefined && attributeName !== undefined) {
                const cluster =
                    endpointId === 0
                        ? this.#rootEndpoint.getClusterClientById(clusterId)
                        : this.appEndpoint.getClusterClientById(clusterId);
                if (!cluster || !cluster.isAttributeSupportedByName(attributeName)) {
                    return;
                }

                attributeId = cluster.attributes[attributeName].id;
            }

            if (endpointId !== undefined && clusterId !== undefined && attributeName !== undefined) {
                const pathId = attributePathToString({ endpointId, clusterId, attributeName });
                this.#matterMappings.set(pathId, type);
            }
            this.#enabledAttributeProperties.set(type, {
                type: 'attribute',
                endpointId,
                clusterId,
                attributeId,
                attributeName,
                convertValue,
                changeHandler,
                pollAttribute,
            });
        }

        stateData.id = `${this.baseId}.`;
        this.#deviceOptions.additionalStateData![type] = stateData;
    }

    /**
     * Enable a state for a Matter attribute if it exists and the property type is supported.
     * Important: provide attributeName for all standard Matter properties OR provide attributeId for vendor specific properties.
     */
    protected enableDeviceTypeStateForEvent(
        type: PropertyType,
        data: {
            endpointId: EndpointNumber;
            clusterId: ClusterId;
            convertValue: (property: PropertyType, event: DecodedEventData<any>) => MaybePromise<any>;
        } & ({ vendorSpecificEventId: EventId } | { eventName: string }),
    ): void {
        const { endpointId, clusterId, convertValue } = data;
        const stateData = this.#deviceOptions.additionalStateData![type] ?? {};

        let eventId: EventId | undefined;
        const eventName =
            'vendorSpecificEventId' in data
                ? `unknownEvent_${Diagnostic.hex(data.vendorSpecificEventId)}`
                : data.eventName;
        if (endpointId !== undefined && clusterId !== undefined && eventName !== undefined) {
            const cluster =
                endpointId === 0
                    ? this.#rootEndpoint.getClusterClientById(clusterId)
                    : this.appEndpoint.getClusterClientById(clusterId);
            if (!cluster) {
                return;
            }

            eventId = cluster.events[eventName].id;
        }

        if (stateData.id !== undefined) {
            stateData.id = `${this.baseId}.`;
        }
        const pathId = eventPathToString({ endpointId, clusterId, eventName });
        this.#deviceOptions.additionalStateData![type] = stateData;
        if (this.#matterMappings.get(pathId)) {
            console.log(`State path ${pathId} already enabled, overwriting`);
        }
        this.#matterMappings.set(pathId, type);
        const knownEvents = this.#enabledEventProperties.get(type) ?? [];
        knownEvents.push({
            type: 'event',
            endpointId,
            clusterId,
            eventId,
            eventName,
            convertValue,
        });
        this.#enabledEventProperties.set(type, knownEvents);
    }

    async getMatterState(property: PropertyType): Promise<any> {
        const matterLocation = this.#enabledAttributeProperties.get(property);
        if (matterLocation === undefined || matterLocation.type !== 'attribute') {
            return;
        }
        const { endpointId, clusterId, attributeName } = matterLocation;
        if (endpointId === undefined || clusterId === undefined || attributeName === undefined) {
            return;
        }

        const cluster =
            endpointId === 0
                ? this.#rootEndpoint.getClusterClientById(clusterId)
                : endpointId === this.appEndpoint.number
                  ? this.appEndpoint.getClusterClientById(clusterId)
                  : undefined;
        if (!cluster) {
            return;
        }
        return cluster.attributes[attributeName].get(false);
    }

    async updateIoBrokerState(property: PropertyType, value: any): Promise<void> {
        const properties = this.#enabledAttributeProperties.get(property);
        if (properties === undefined || properties.type !== 'attribute') {
            return;
        }
        const { convertValue } = properties;
        if (convertValue !== undefined) {
            value = convertValue(value);
            if (MaybePromise.is(value)) {
                value = await value;
            }
        }
        if (value !== undefined) {
            try {
                await this.ioBrokerDevice.updatePropertyValue(property, value);
            } catch (e) {
                this.#adapter.log.error(`Error updating property ${property} with value ${value}: ${e}`);
            }

            if (property === PropertyType.Unreachable && this.#hasBridgedReachabilityAttribute) {
                await this.#adapter.setState(this.#connectionStateId, { val: !value, ack: true });
            }
        }
    }

    async handleChangedAttribute(data: {
        clusterId: ClusterId;
        endpointId: EndpointNumber;
        attributeId: AttributeId;
        attributeName: string;
        value: any;
    }): Promise<void> {
        const pathId = attributePathToString(data);
        const pathProperty = this.#matterMappings.get(pathId);
        if (pathProperty === undefined) {
            return;
        }
        if (typeof pathProperty === 'function') {
            const result = pathProperty(data.value);
            if (MaybePromise.is(result)) {
                await result;
            }
            return;
        }
        return this.updateIoBrokerState(pathProperty, data.value);
    }

    async handleTriggeredEvent(data: {
        clusterId: ClusterId;
        endpointId: EndpointNumber;
        eventId: EventId;
        eventName: string;
        events: DecodedEventData<any>[];
    }): Promise<void> {
        const pathId = eventPathToString(data);
        const pathProperty = this.#matterMappings.get(pathId);
        if (pathProperty === undefined) {
            return;
        }
        if (typeof pathProperty === 'function') {
            for (const event of data.events) {
                const result = pathProperty(event);
                if (MaybePromise.is(result)) {
                    await result;
                }
            }
            return;
        }
        const propertyHandlers = this.#enabledEventProperties.get(pathProperty);
        if (propertyHandlers === undefined) {
            return;
        }
        for (const { convertValue } of propertyHandlers) {
            for (const event of data.events) {
                let value = convertValue(pathProperty, event);
                if (value !== undefined) {
                    if (MaybePromise.is(value)) {
                        value = await value;
                    }
                    await this.updateIoBrokerState(pathProperty, value);
                }
            }
        }
    }

    /** Initialization Logic for the device. makes sure all handlers are registered for both sides. */
    async init(): Promise<void> {
        const existingObject = await this.#adapter.getObjectAsync(this.baseId);
        if (existingObject) {
            if (existingObject.common.name) {
                this.#name =
                    typeof existingObject.common.name === 'string'
                        ? existingObject.common.name
                        : existingObject.common.name.en;
            }
            this.setDeviceConfiguration({
                pollInterval: existingObject.native?.pollInterval,
            });
        }

        await this.ioBrokerDevice.init();
        this.#registerIoBrokerHandlersAndInitialize();
        await this.#initializeStates();

        if (this.#name === undefined) {
            this.#name = this.#defaultName;
        }

        if (this.#hasBridgedReachabilityAttribute) {
            await this.#adapter.setObjectNotExists(`${this.baseId}.info`, {
                type: 'channel',
                common: {
                    name: 'Bridged Device connection info',
                },
                native: {},
            });

            this.#connectionStateId = `${this.baseId}.info.connection`;
            await this.#adapter.setObjectNotExists(`${this.#connectionStateId}`, {
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

            await this.#adapter.setState(this.#connectionStateId, {
                val:
                    (await this.appEndpoint
                        .getClusterClient(BridgedDeviceBasicInformation.Cluster)
                        ?.getReachableAttribute()) ?? false,
                ack: true,
            });
        }

        if (!existingObject || existingObject.common.statusStates?.onlineId !== this.#connectionStateId) {
            await this.#adapter.extendObjectAsync(this.baseId, {
                common: {
                    statusStates: {
                        onlineId: `${this.#connectionStateId}`,
                    },
                },
            });
        }

        this.#initialized = true;
    }

    #registerIoBrokerHandlersAndInitialize(): void {
        // install ioBroker listeners
        // here we react on changes from the ioBroker side for onOff and current lamp level
        this.ioBrokerDevice.onChange(async (event: { property: PropertyType; value: unknown }) => {
            const matterLocation = this.#enabledAttributeProperties.get(event.property);
            if (matterLocation === undefined || matterLocation.type !== 'attribute') {
                return;
            }
            const { changeHandler } = matterLocation;
            if (changeHandler === undefined) {
                return;
            }
            //console.log(`handle change event for ${event.property} with value ${event.value}`);
            await changeHandler(event.value);
        });
    }

    /** Initialize the states of the ioBroker device with the current values from the matter device. */
    async #initializeStates(): Promise<void> {
        for (const property of this.#enabledAttributeProperties.keys()) {
            const value = await this.getMatterState(property);
            if (value !== undefined) {
                await this.updateIoBrokerState(property, value);
            }
        }
        this.#initAttributePolling();
    }

    #initAttributePolling(): void {
        if (this.#pollTimeout !== undefined) {
            clearTimeout(this.#pollTimeout);
            this.#pollTimeout = undefined;
        }
        const pollingAttributes = new Array<{
            endpointId: EndpointNumber;
            clusterId: ClusterId;
            attributeId: AttributeId;
        }>();
        for (const property of this.#enabledAttributeProperties.values()) {
            if (property.type === 'attribute' && property.pollAttribute) {
                const { endpointId, clusterId, attributeId } = property;
                if (endpointId !== undefined && clusterId !== undefined && attributeId !== undefined) {
                    pollingAttributes.push({ endpointId, clusterId, attributeId });
                }
            }
        }
        if (pollingAttributes.length) {
            this.#hasAttributesToPoll = true;
            this.#pollTimeout = setTimeout(() => this.#pollAttributes(pollingAttributes), this.#pollInterval);
        }
    }

    async #pollAttributes(
        attributes: {
            endpointId: EndpointNumber;
            clusterId: ClusterId;
            attributeId: AttributeId;
        }[],
    ): Promise<void> {
        this.#pollTimeout = undefined;
        if (this.#destroyed || attributes.length === 0) {
            return;
        }

        if (this.#node.isConnected) {
            // Split in chunks of maximum 9 attributes and get an interactionClient from node
            const client = await this.#node.getInteractionClient();

            for (let i = 0; i < attributes.length; i += 9) {
                if (this.#destroyed) {
                    return;
                }
                // Maximum read for 9 attribute paths is allowed, so split in chunks of 9
                const chunk = attributes.slice(i, i + 9);

                // Collect the endpoints and clusters and get the last known data version for each to use as filter
                const endpointClusters = new Map<string, { endpointId: EndpointNumber; clusterId: ClusterId }>();
                for (const { endpointId, clusterId } of chunk) {
                    const key = `${endpointId}-${clusterId}`;
                    endpointClusters.set(key, { endpointId, clusterId });
                }
                const dataVersionFilters = new Array<{
                    endpointId: EndpointNumber;
                    clusterId: ClusterId;
                    dataVersion: number;
                }>();
                for (const data of endpointClusters.values()) {
                    const filter = client.getCachedClusterDataVersions(data);
                    if (filter.length) {
                        dataVersionFilters.push(filter[0]);
                    }
                }

                try {
                    // Query the attributes
                    const result = await client.getMultipleAttributes({
                        attributes: chunk.map(({ endpointId, clusterId, attributeId }) => ({
                            endpointId,
                            clusterId,
                            attributeId,
                        })),
                        dataVersionFilters,
                    });

                    // Handle the results as if they would have come as subscription update
                    for (const {
                        path: { endpointId, clusterId, attributeId, attributeName },
                        value,
                    } of result) {
                        await this.handleChangedAttribute({
                            clusterId,
                            endpointId,
                            attributeId,
                            attributeName,
                            value,
                        });
                    }
                } catch (e) {
                    this.#adapter.log.info(`Error polling attributes for node ${this.#node.nodeId}: ${e}`);
                }
            }
        } else {
            this.#adapter.log.debug(`Node ${this.#node.nodeId} is not connected, do not poll attributes`);
        }

        if (!this.#destroyed) {
            this.#pollTimeout = setTimeout(() => this.#pollAttributes(attributes), this.#pollInterval);
        }
    }

    async destroy(): Promise<void> {
        this.#destroyed = true;
        if (this.#pollTimeout !== undefined) {
            clearTimeout(this.#pollTimeout);
            this.#pollTimeout = undefined;
        }
        if (this.#hasBridgedReachabilityAttribute) {
            await this.#adapter.setState(this.#connectionStateId, { val: false, ack: true });
        }
        return this.ioBrokerDevice.destroy();
    }

    hasIdentify(): boolean {
        return this.appEndpoint.hasClusterClient(Identify.Cluster);
    }

    async identify(identifyTime = 30): Promise<void> {
        await this.appEndpoint.getClusterClient(Identify.Cluster)?.identify({ identifyTime });
    }

    async rename(name: string): Promise<void> {
        this.#name = name;
        await this.#adapter.extendObjectAsync(this.baseId, { common: { name } });
    }

    async getMatterStates(): Promise<Record<string, unknown>> {
        const states: Record<string, unknown> = {};

        const powerSource = this.appEndpoint.getClusterClient(PowerSource.Complete);
        if (powerSource !== undefined) {
            states.__header__powersourcedetails = 'Power Source Details';

            if (
                powerSource.isAttributeSupportedByName('batQuantity') &&
                powerSource.isAttributeSupportedByName('batReplacementDescription')
            ) {
                states.includedBattery = `${await powerSource.getBatQuantityAttribute()} x ${await powerSource.getBatReplacementDescriptionAttribute()}`;
            }
            const voltage = powerSource.isAttributeSupportedByName('batVoltage')
                ? await powerSource.getBatVoltageAttribute()
                : undefined;
            const percentRemaining = powerSource.isAttributeSupportedByName('batPercentRemaining')
                ? await powerSource.getBatPercentRemainingAttribute()
                : undefined;

            if (typeof voltage === 'number') {
                states.batteryVoltage = `${(voltage / 1_000).toFixed(2)} V${typeof percentRemaining === 'number' ? ` (${Math.round(percentRemaining / 2)}%)` : ''}`;
            } else if (typeof percentRemaining === 'number') {
                states.batteryVoltage = `${Math.round(percentRemaining / 2)}%`;
            }

            if (!states.includedBattery && !states.batteryVoltage) {
                delete states.__header__powersourcedetails;
            }
        }

        return states;
    }

    async getDeviceDetails(): Promise<StructuredJsonFormData> {
        const result: StructuredJsonFormData = {};

        const states = this.ioBrokerDevice.getStates();
        if (Object.keys(states).length) {
            result.states = {
                __header__details: 'Mapped ioBroker States',
                ...states,
            };
        }

        result.details = {
            __header__details: 'Device Details',
            name: this.#name,
            primaryDeviceType: this.deviceType,
            deviceTypes: this.appEndpoint
                .getDeviceTypes()
                .map(({ name, code }) => `${name} (${toHex(code)})`)
                .join(', '),
            endpoint: this.appEndpoint.number,
            ...(await this.getMatterStates()),
        } as Record<string, unknown>;

        result.matterClusters = {} as Record<string, unknown>;
        for (const client of this.appEndpoint.getAllClusterClients()) {
            const activeFeatures = new Array<string>();
            Object.keys(client.supportedFeatures).forEach(f => client.supportedFeatures[f] && activeFeatures.push(f));
            result.matterClusters[`__header__${client.name}`] = decamelize(client.name);
            result.matterClusters[`${client.name}__Features`] = activeFeatures.length
                ? activeFeatures.map(name => decamelize(name)).join(', ')
                : 'no explicit feature set';
            result.matterClusters[`${client.name}__Revision`] = client.revision;
        }

        return result;
    }

    get deviceConfiguration(): { pollInterval?: number } {
        return {
            pollInterval: this.#hasAttributesToPoll ? Math.round(this.#pollInterval / 1000) : undefined,
        };
    }

    setDeviceConfiguration(config: GenericDeviceConfiguration): void {
        const { pollInterval } = config;
        if (pollInterval !== undefined) {
            if (isNaN(pollInterval) || pollInterval < 30 || pollInterval > 2_147_482) {
                this.#adapter.log.warn(
                    `Invalid polling interval ${pollInterval} seconds, use former value of ${Math.round(this.#pollInterval / 1000)}.`,
                );
                return;
            }
            this.#pollInterval = pollInterval * 1000;
            if (this.#initialized) {
                // If already initialized, restart polling
                this.#initAttributePolling();
            }
        }
    }

    async getStatus(nodeStatus: DeviceStatus): Promise<DeviceStatus> {
        const status: DeviceStatus = {
            connection: typeof nodeStatus === 'object' ? nodeStatus.connection : nodeStatus,
        };

        if (status.connection === 'connected') {
            const powerSource = this.appEndpoint.getClusterClient(PowerSource.Complete);
            if (powerSource !== undefined) {
                if (
                    powerSource.isAttributeSupportedByName('BatChargeState') &&
                    (await powerSource.getBatChargeStateAttribute(false)) === PowerSource.BatChargeState.IsCharging
                ) {
                    status.battery = 'charging';
                } else {
                    const voltage = powerSource.isAttributeSupportedByName('batVoltage')
                        ? await powerSource.getBatVoltageAttribute(false)
                        : undefined;
                    const percentRemaining = powerSource.isAttributeSupportedByName('batPercentRemaining')
                        ? await powerSource.getBatPercentRemainingAttribute(false)
                        : undefined;

                    if (typeof percentRemaining === 'number') {
                        status.battery = Math.round(percentRemaining / 2);
                    } else if (typeof voltage === 'number') {
                        status.battery = `${voltage}mV`;
                    }
                }
            }
        }
        return status;
    }
}
