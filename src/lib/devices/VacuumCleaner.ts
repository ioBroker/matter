import { type DeviceStateObject, PropertyType, ValueType } from './DeviceStateObject';
import GenericDevice, { type DetectedDevice, type DeviceOptions, StateAccessType } from './GenericDevice';

enum VacuumCleanerMode {
    AUTO = 'AUTO',
    ECO = 'ECO',
    EXPRESS = 'EXPRESS',
    NORMAL = 'NORMAL',
    QUIET = 'QUIET',
}

enum VacuumCleanerWorkMode {
    AUTO = 'AUTO',
    FAST = 'FAST',
    MEDIUM = 'MEDIUM',
    SLOW = 'SLOW',
    TURBO = 'TURBO',
}

enum VacuumCleanerState {
    HOME = 'HOME',
    CLEANING = 'CLEANING',
    PAUSE = 'PAUSE',
}

class VacuumCleaner extends GenericDevice {
    #powerState?: DeviceStateObject<boolean>;
    #modeState?: DeviceStateObject<VacuumCleanerMode>;
    #getMapBase64State?: DeviceStateObject<string>;
    #getMapUrlState?: DeviceStateObject<string>;
    #workModeState?: DeviceStateObject<VacuumCleanerWorkMode>;
    #getWaterState?: DeviceStateObject<number>;
    #getWasteState?: DeviceStateObject<number>;
    #getStateState?: DeviceStateObject<VacuumCleanerState>;
    #pauseState?: DeviceStateObject<boolean>;
    #getWasteAlarmState?: DeviceStateObject<boolean>;
    #getWaterAlarmState?: DeviceStateObject<boolean>;
    #getFilterState?: DeviceStateObject<number>;
    #getBrushState?: DeviceStateObject<number>;
    #getSensorsState?: DeviceStateObject<number>;
    #getSideBrushState?: DeviceStateObject<number>;

    constructor(detectedDevice: DetectedDevice, adapter: ioBroker.Adapter, options?: DeviceOptions) {
        super(detectedDevice, adapter, options);

        this._construction.push(
            this.addDeviceStates([
                {
                    name: 'POWER',
                    valueType: ValueType.Boolean,
                    accessType: StateAccessType.ReadWrite,
                    type: PropertyType.Power,
                    callback: state => (this.#powerState = state),
                },
                {
                    name: 'MODE',
                    valueType: ValueType.Enum,
                    accessType: StateAccessType.ReadWrite,
                    type: PropertyType.Mode,
                    callback: state => (this.#modeState = state),
                },
                {
                    name: 'MAP_BASE64',
                    valueType: ValueType.String,
                    accessType: StateAccessType.Read,
                    type: PropertyType.MapBase64,
                    callback: state => (this.#getMapBase64State = state),
                },
                {
                    name: 'MAP_URL',
                    valueType: ValueType.String,
                    accessType: StateAccessType.Read,
                    type: PropertyType.MapUrl,
                    callback: state => (this.#getMapUrlState = state),
                },
                {
                    name: 'WORK_MODE',
                    valueType: ValueType.Enum,
                    accessType: StateAccessType.ReadWrite,
                    type: PropertyType.WorkMode,
                    callback: state => (this.#workModeState = state),
                },
                {
                    name: 'WATER',
                    valueType: ValueType.NumberPercent,
                    accessType: StateAccessType.Read,
                    type: PropertyType.Water,
                    callback: state => (this.#getWaterState = state),
                },
                {
                    name: 'WASTE',
                    valueType: ValueType.NumberPercent,
                    accessType: StateAccessType.Read,
                    type: PropertyType.Waste,
                    callback: state => (this.#getWasteState = state),
                },
                {
                    name: 'STATE',
                    valueType: ValueType.Enum,
                    accessType: StateAccessType.Read,
                    type: PropertyType.State,
                    callback: state => (this.#getStateState = state),
                },
                {
                    name: 'PAUSE',
                    valueType: ValueType.Button,
                    accessType: StateAccessType.Write,
                    type: PropertyType.Pause,
                    callback: state => (this.#pauseState = state),
                },
                {
                    name: 'WASTE_ALARM',
                    valueType: ValueType.Boolean,
                    accessType: StateAccessType.Read,
                    type: PropertyType.WasteAlarm,
                    callback: state => (this.#getWasteAlarmState = state),
                },
                {
                    name: 'WATER_ALARM',
                    valueType: ValueType.Boolean,
                    accessType: StateAccessType.Read,
                    type: PropertyType.WaterAlarm,
                    callback: state => (this.#getWaterAlarmState = state),
                },
                {
                    name: 'FILTER',
                    valueType: ValueType.NumberPercent,
                    accessType: StateAccessType.Read,
                    type: PropertyType.Filter,
                    callback: state => (this.#getFilterState = state),
                },
                {
                    name: 'BRUSH',
                    valueType: ValueType.NumberPercent,
                    accessType: StateAccessType.Read,
                    type: PropertyType.Brush,
                    callback: state => (this.#getBrushState = state),
                },
                {
                    name: 'SENSORS',
                    valueType: ValueType.NumberPercent,
                    accessType: StateAccessType.Read,
                    type: PropertyType.Sensors,
                    callback: state => (this.#getSensorsState = state),
                },
                {
                    name: 'SIDE_BRUSH',
                    valueType: ValueType.NumberPercent,
                    accessType: StateAccessType.Read,
                    type: PropertyType.SideBrush,
                    callback: state => (this.#getSideBrushState = state),
                },
            ]),
        );
    }

    getPower(): boolean | undefined {
        if (!this.#powerState) {
            throw new Error('Power state not found');
        }
        return this.#powerState.value;
    }

    setPower(value: boolean): Promise<void> {
        if (!this.#powerState) {
            throw new Error('Power state not found');
        }
        return this.#powerState.setValue(value);
    }

    getMode(): VacuumCleanerMode | undefined {
        if (!this.#modeState) {
            throw new Error('Mode state not found');
        }
        return this.#modeState.value;
    }

    setMode(mode: VacuumCleanerMode): Promise<void> {
        if (!this.#modeState) {
            throw new Error('Mode state not found');
        }
        return this.#modeState.setValue(mode);
    }

    getModes(): VacuumCleanerMode[] {
        if (!this.#modeState) {
            throw new Error('Mode state not found');
        }
        return this.#modeState.getModes();
    }

    getMapBase64(): string | undefined {
        if (!this.#getMapBase64State) {
            throw new Error('MapBase64 state not found');
        }
        return this.#getMapBase64State.value;
    }

    getMapUrl(): string | undefined {
        if (!this.#getMapUrlState) {
            throw new Error('MapUrl state not found');
        }
        return this.#getMapUrlState.value;
    }

    getWorkMode(): VacuumCleanerWorkMode | undefined {
        if (!this.#workModeState) {
            throw new Error('WorkMode state not found');
        }
        return this.#workModeState.value;
    }

    setWorkMode(mode: VacuumCleanerWorkMode): Promise<void> {
        if (!this.#workModeState) {
            throw new Error('WorkMode state not found');
        }
        return this.#workModeState.setValue(mode);
    }

    getWorkModes(): VacuumCleanerWorkMode[] {
        if (!this.#workModeState) {
            throw new Error('WorkMode state not found');
        }
        return this.#workModeState.getModes();
    }

    getWater(): number | undefined {
        if (!this.#getWaterState) {
            throw new Error('Water state not found');
        }
        return this.#getWaterState.value;
    }

    getWaste(): number | undefined {
        if (!this.#getWasteState) {
            throw new Error('Waste state not found');
        }
        return this.#getWasteState.value;
    }

    getState(): VacuumCleanerState | undefined {
        if (!this.#getStateState) {
            throw new Error('State state not found');
        }
        return this.#getStateState.value;
    }

    getStateModes(): VacuumCleanerState[] {
        if (!this.#getStateState) {
            throw new Error('State state not found');
        }
        return this.#getStateState.getModes();
    }

    setPause(value: boolean): Promise<void> {
        if (!this.#pauseState) {
            throw new Error('Pause state not found');
        }
        return this.#pauseState.setValue(value);
    }

    getWasteAlarm(): boolean | undefined {
        if (!this.#getWasteAlarmState) {
            throw new Error('WasteAlarm state not found');
        }
        return this.#getWasteAlarmState.value;
    }

    getWaterAlarm(): boolean | undefined {
        if (!this.#getWaterAlarmState) {
            throw new Error('WaterAlarm state not found');
        }
        return this.#getWaterAlarmState.value;
    }

    getFilter(): number | undefined {
        if (!this.#getFilterState) {
            throw new Error('Filter state not found');
        }
        return this.#getFilterState.value;
    }

    getBrush(): number | undefined {
        if (!this.#getBrushState) {
            throw new Error('Brush state not found');
        }
        return this.#getBrushState.value;
    }

    getSensors(): number | undefined {
        if (!this.#getSensorsState) {
            throw new Error('Sensors state not found');
        }
        return this.#getSensorsState.value;
    }

    getSideBrush(): number | undefined {
        if (!this.#getSideBrushState) {
            throw new Error('SideBrush state not found');
        }
        return this.#getSideBrushState.value;
    }
}

export default VacuumCleaner;
