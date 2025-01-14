import ChannelDetector from '@iobroker/type-detector';
import { WindowCovering } from '@matter/main/clusters';
import type { Endpoint, PairedNode } from '@project-chip/matter.js/device';
import type { GenericDevice } from '../../lib';
import { PropertyType } from '../../lib/devices/DeviceStateObject';
import type { DetectedDevice, DeviceOptions } from '../../lib/devices/GenericDevice';
import { GenericElectricityDataDeviceToIoBroker } from './GenericElectricityDataDeviceToIoBroker';
import Blind from '../../lib/devices/Blind';
import BlindButtons from '../../lib/devices/BlindButtons';
import type { TypeFromBitSchema } from '@matter/main/types';

/** Mapping Logic to map a ioBroker Socket device to a Matter OnOffPlugInUnitDevice. */
export class WindowCoveringToIoBroker extends GenericElectricityDataDeviceToIoBroker {
    readonly #ioBrokerDevice: Blind | BlindButtons;
    #maintenanceState: { operational: boolean; maintenance: boolean } = { operational: false, maintenance: false };

    constructor(
        node: PairedNode,
        endpoint: Endpoint,
        rootEndpoint: Endpoint,
        adapter: ioBroker.Adapter,
        endpointDeviceBaseId: string,
        deviceTypeName: string,
        defaultConnectionStateId: string,
        defaultName: string,
    ) {
        super(
            adapter,
            node,
            endpoint,
            rootEndpoint,
            endpointDeviceBaseId,
            deviceTypeName,
            defaultConnectionStateId,
            defaultName,
        );

        if (
            this.appEndpoint.getClusterClient(WindowCovering.Complete)?.supportedFeatures.positionAwareLift ||
            this.appEndpoint.getClusterClient(WindowCovering.Complete)?.supportedFeatures.positionAwareTilt
        ) {
            this.#ioBrokerDevice = new Blind(
                { ...ChannelDetector.getPatterns().blinds, isIoBrokerDevice: false } as DetectedDevice,
                adapter,
                this.enableDeviceTypeStates(),
            );
        } else {
            this.#ioBrokerDevice = new BlindButtons(
                { ...ChannelDetector.getPatterns().blindButtons, isIoBrokerDevice: false } as DetectedDevice,
                adapter,
                this.enableDeviceTypeStates(),
            );
        }
    }

    async updateWorkingStateForLift(currentLiftValue: number | null): Promise<void> {
        const targetValue = await this.appEndpoint
            .getClusterClient(WindowCovering.Complete)
            ?.getTargetPositionLiftPercent100thsAttribute();
        if (
            targetValue !== undefined &&
            targetValue !== null &&
            currentLiftValue !== null &&
            targetValue !== currentLiftValue
        ) {
            await this.ioBrokerDevice.updateWorking(true);
        }
    }

    async updateWorkingStateForTilt(currentTiltValue: number | null): Promise<void> {
        const targetValue = await this.appEndpoint
            .getClusterClient(WindowCovering.Complete)
            ?.getTargetPositionTiltPercent100thsAttribute();
        if (
            targetValue !== undefined &&
            targetValue !== null &&
            currentTiltValue !== null &&
            targetValue !== currentTiltValue
        ) {
            await this.ioBrokerDevice.updateWorking(true);
        }
    }

    protected enableDeviceTypeStates(): DeviceOptions {
        const features = this.appEndpoint.getClusterClient(WindowCovering.Complete)?.supportedFeatures ?? {};

        this.enableDeviceTypeStateForAttribute(PropertyType.Maintenance, {
            endpointId: this.appEndpoint.getNumber(),
            clusterId: WindowCovering.Cluster.id,
            attributeName: 'configStatus',
            convertValue: (value: TypeFromBitSchema<typeof WindowCovering.ConfigStatus>) => {
                this.#maintenanceState.operational = value.operational;
                return this.#maintenanceState.maintenance || !this.#maintenanceState.operational;
            },
        });
        this.registerStateChangeHandlerForAttribute({
            endpointId: this.appEndpoint.getNumber(),
            clusterId: WindowCovering.Cluster.id,
            attributeName: 'mode',
            matterValueChanged: (value: TypeFromBitSchema<typeof WindowCovering.Mode>) => {
                this.#maintenanceState.maintenance = value.maintenanceMode;
                this.ioBrokerDevice
                    .updateMaintenance(this.#maintenanceState.maintenance || !this.#maintenanceState.operational)
                    .catch(e => this.ioBrokerDevice.adapter.log.error(`Failed to update maintenance state: ${e}`));
            },
        });

        this.enableDeviceTypeStateForAttribute(PropertyType.Working, {
            endpointId: this.appEndpoint.getNumber(),
            clusterId: WindowCovering.Cluster.id,
            attributeName: 'operationalStatus',
            convertValue: (value: TypeFromBitSchema<typeof WindowCovering.OperationalStatus>) =>
                value.global !== WindowCovering.MovementStatus.Stopped,
        });
        // TODO introduce value.direction once in type definition
        /*this.enableDeviceTypeStateForAttribute(PropertyType.Direction, {
            endpointId: this.appEndpoint.getNumber(),
            clusterId: WindowCovering.Cluster.id,
            attributeName: 'configStatus',
            convertValue: (value: TypeFromBitSchema<typeof WindowCovering.OperationalStatus>) => {
                return value.global !== WindowCovering.MovementStatus.Stopped;
            },
        });*/

        if (features.lift) {
            this.enableDeviceTypeStateForAttribute(PropertyType.Level, {
                endpointId: this.appEndpoint.getNumber(),
                clusterId: WindowCovering.Cluster.id,
                attributeName: 'currentPositionLiftPercent100ths',
                convertValue: value => {
                    this.updateWorkingStateForLift(value).catch(e =>
                        this.ioBrokerDevice.adapter.log.error(`Failed to update working state: ${e}`),
                    );
                    return Math.round(value / 100);
                },
                changeHandler: async value => {
                    if (
                        !this.appEndpoint.getClusterClient(WindowCovering.Complete)?.supportedFeatures.positionAwareLift
                    ) {
                        throw new Error('Position aware lift not supported. Can not set lift target percentage');
                    }
                    await this.appEndpoint.getClusterClient(WindowCovering.Complete)?.goToLiftPercentage({
                        liftPercent100thsValue: Math.round(value * 100),
                    });
                },
            });
            this.enableDeviceTypeStateForAttribute(PropertyType.LevelActual, {
                endpointId: this.appEndpoint.getNumber(),
                clusterId: WindowCovering.Cluster.id,
                attributeName: 'currentPositionLiftPercent100ths',
                convertValue: value => Math.round(value / 100),
            });

            this.enableDeviceTypeStateForAttribute(PropertyType.Stop, {
                changeHandler: async value => {
                    if (!value) {
                        return;
                    }
                    await this.appEndpoint.getClusterClient(WindowCovering.Complete)?.stopMotion();
                },
            });
            this.enableDeviceTypeStateForAttribute(PropertyType.Open, {
                changeHandler: async value => {
                    if (!value) {
                        return;
                    }
                    await this.appEndpoint.getClusterClient(WindowCovering.Complete)?.upOrOpen();
                },
            });
            this.enableDeviceTypeStateForAttribute(PropertyType.Close, {
                changeHandler: async value => {
                    if (!value) {
                        return;
                    }
                    await this.appEndpoint.getClusterClient(WindowCovering.Complete)?.downOrClose();
                },
            });
        }

        if (features.tilt) {
            this.enableDeviceTypeStateForAttribute(PropertyType.TiltLevel, {
                endpointId: this.appEndpoint.getNumber(),
                clusterId: WindowCovering.Cluster.id,
                attributeName: 'currentPositionTiltPercent100ths',
                convertValue: value => {
                    this.updateWorkingStateForTilt(value).catch(e =>
                        this.ioBrokerDevice.adapter.log.error(`Failed to update working state: ${e}`),
                    );
                    return Math.round(value / 100);
                },
                changeHandler: async value => {
                    if (
                        !this.appEndpoint.getClusterClient(WindowCovering.Complete)?.supportedFeatures.positionAwareTilt
                    ) {
                        throw new Error('Position aware tilt not supported. Can not set tilt target percentage');
                    }
                    await this.appEndpoint.getClusterClient(WindowCovering.Complete)?.goToTiltPercentage({
                        tiltPercent100thsValue: Math.round(value * 100),
                    });
                },
            });
            this.enableDeviceTypeStateForAttribute(PropertyType.TiltLevelActual, {
                endpointId: this.appEndpoint.getNumber(),
                clusterId: WindowCovering.Cluster.id,
                attributeName: 'currentPositionTiltPercent100ths',
                convertValue: value => Math.round(value / 100),
            });
        }

        return super.enableDeviceTypeStates();
    }

    override async init(): Promise<void> {
        await super.init();

        const windowCovering = this.appEndpoint.getClusterClient(WindowCovering.Complete);
        if (windowCovering !== undefined) {
            this.#maintenanceState = {
                maintenance: !!(
                    (await windowCovering.getModeAttribute()) ?? {
                        maintenanceMode: true,
                    }
                ).maintenanceMode,
                operational: !!(
                    (await windowCovering.getConfigStatusAttribute()) ?? {
                        operational: true,
                    }
                ).operational,
            };
        }
    }

    get ioBrokerDevice(): GenericDevice {
        return this.#ioBrokerDevice;
    }
}
