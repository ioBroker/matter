import { type DeviceStateObject, PropertyType, ValueType } from './DeviceStateObject';
import ElectricityDataDevice from './ElectricityDataDevice';
import { type DetectedDevice, type DeviceOptions, StateAccessType } from './GenericDevice';

enum AirConditionerMode {
    Auto = 'AUTO',
    Cool = 'COOL',
    Dry = 'DRY',
    Eco = 'ECO',
    FanOnly = 'FAN_ONLY',
    Heat = 'HEAT',
    Off = 'OFF',
}

enum AirConditionerSpeed {
    Auto = 'AUTO',
    High = 'HIGH',
    Low = 'LOW',
    Medium = 'MEDIUM',
    Quiet = 'QUIET',
    Turbo = 'TURBO',
}

enum AirConditionerSwing {
    Auto = 'AUTO',
    Horizontal = 'HORIZONTAL',
    Stationary = 'STATIONARY',
    Vertical = 'VERTICAL',
}

class AirCondition extends ElectricityDataDevice {
    #levelState?: DeviceStateObject<number>;
    #getTemperatureState?: DeviceStateObject<number>;
    #powerState?: DeviceStateObject<boolean>;
    #getHumidityState?: DeviceStateObject<number>;
    #speedState?: DeviceStateObject<AirConditionerSpeed>;
    #boostState?: DeviceStateObject<boolean | number>;
    #SwingState?: DeviceStateObject<AirConditionerSwing>;
    #modeState?: DeviceStateObject<AirConditionerMode>;

    constructor(detectedDevice: DetectedDevice, adapter: ioBroker.Adapter, options?: DeviceOptions) {
        super(detectedDevice, adapter, options);

        this._construction.push(
            this.addDeviceStates([
                {
                    name: 'SET',
                    valueType: ValueType.NumberMinMax,
                    accessType: StateAccessType.ReadWrite,
                    type: PropertyType.Level,
                    callback: state => (this.#levelState = state),
                },

                {
                    name: 'ACTUAL',
                    valueType: ValueType.Number,
                    accessType: StateAccessType.Read,
                    type: PropertyType.Temperature,
                    callback: state => (this.#getTemperatureState = state),
                },
                {
                    name: 'POWER',
                    valueType: ValueType.Boolean,
                    accessType: StateAccessType.ReadWrite,
                    type: PropertyType.Power,
                    callback: state => (this.#powerState = state),
                },
                {
                    name: 'HUMIDITY',
                    valueType: ValueType.NumberPercent,
                    accessType: StateAccessType.Read,
                    type: PropertyType.Humidity,
                    callback: state => (this.#getHumidityState = state),
                },
                {
                    name: 'SPEED',
                    valueType: ValueType.Enum,
                    accessType: StateAccessType.ReadWrite,
                    type: PropertyType.Speed,
                    callback: state => (this.#speedState = state),
                },
                {
                    name: 'BOOST',
                    valueType: ValueType.Boolean,
                    accessType: StateAccessType.ReadWrite,
                    type: PropertyType.Boost,
                    callback: state => (this.#boostState = state),
                },
                {
                    name: 'SWING',
                    valueType: ValueType.Boolean,
                    accessType: StateAccessType.ReadWrite,
                    type: PropertyType.Swing,
                    callback: state => (this.#SwingState = state),
                },
                {
                    name: 'MODE',
                    valueType: ValueType.Enum,
                    accessType: StateAccessType.ReadWrite,
                    type: PropertyType.Mode,
                    callback: state => (this.#modeState = state),
                },
            ]),
        );
    }

    getLevel(): number | undefined {
        if (!this.#levelState) {
            throw new Error('Level state not found');
        }
        return this.#levelState.value;
    }

    setLevel(value: number): Promise<void> {
        if (!this.#levelState) {
            throw new Error('Level state not found');
        }
        return this.#levelState.setValue(value);
    }

    getTemperature(): number | undefined {
        if (!this.#getTemperatureState) {
            throw new Error('Temperature state not found');
        }
        return this.#getTemperatureState.value;
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

    getHumidity(): number | undefined {
        if (!this.#getHumidityState) {
            throw new Error('Humidity state not found');
        }
        return this.#getHumidityState.value;
    }

    getBoost(): boolean | number | undefined {
        if (!this.#boostState) {
            throw new Error('Boost state not found');
        }
        return this.#boostState.value;
    }

    setBoost(value: boolean | number): Promise<void> {
        if (!this.#boostState) {
            throw new Error('Boost state not found');
        }
        return this.#boostState.setValue(value);
    }

    getSpeed(): AirConditionerSpeed | undefined {
        if (!this.#speedState) {
            throw new Error('Speed state not found');
        }
        return this.#speedState.value;
    }

    setSpeed(value: AirConditionerSpeed): Promise<void> {
        if (!this.#speedState) {
            throw new Error('Speed state not found');
        }
        return this.#speedState.setValue(value);
    }

    getSpeedModes(): AirConditionerSpeed[] {
        if (!this.#speedState) {
            throw new Error('Speed state not found');
        }
        return this.#speedState.getModes();
    }

    getSwing(): AirConditionerSwing | undefined {
        if (!this.#SwingState) {
            throw new Error('Swing state not found');
        }
        return this.#SwingState.value;
    }

    setSwing(value: AirConditionerSwing): Promise<void> {
        if (!this.#SwingState) {
            throw new Error('Swing state not found');
        }
        return this.#SwingState.setValue(value);
    }

    getSwingModes(): AirConditionerSwing[] {
        if (!this.#SwingState) {
            throw new Error('Swing state not found');
        }
        return this.#SwingState.getModes();
    }

    getMode(): AirConditionerMode | undefined {
        if (!this.#modeState) {
            throw new Error('Mode state not found');
        }
        return this.#modeState.value;
    }

    setMode(mode: AirConditionerMode): Promise<void> {
        if (!this.#modeState) {
            throw new Error('Mode state not found');
        }
        return this.#modeState.setValue(mode);
    }

    getModes(): AirConditionerMode[] {
        if (!this.#modeState) {
            throw new Error('Mode state not found');
        }
        return this.#modeState.getModes();
    }
}

export default AirCondition;
