import { type DeviceStateObject, PropertyType, ValueType } from './DeviceStateObject';
import GenericDevice, { type DetectedDevice, type DeviceOptions, StateAccessType } from './GenericDevice';

export enum ThermostatMode {
    // MANUAL, VACATION, COOL, DRY, ECO, FAN_ONLY, HEAT, OFF
    Auto = 'AUTO',
    Manual = 'MANUAL',
    Vacation = 'VACATION',
    Cool = 'COOL',
    Dry = 'DRY',
    Eco = 'ECO',
    FanOnly = 'FAN_ONLY',
    Heat = 'HEAT',
    Off = 'OFF',
}

export enum ThermostatModeNumbers {
    AUTO = 0,
    MANUAL = 1,
    VACATION = 2,
    COOL = 3,
    DRY = 4,
    ECO = 5,
    FAN_ONLY = 6,
    HEAT = 7,
    OFF = 8,
}

class Thermostat extends GenericDevice {
    #levelState?: DeviceStateObject<number>;
    #getTemperatureState?: DeviceStateObject<number>;
    #powerState?: DeviceStateObject<boolean | number>;
    #getHumidityState?: DeviceStateObject<number>;
    #boostState?: DeviceStateObject<number>;
    #partyState?: DeviceStateObject<boolean | number>;
    #modeState?: DeviceStateObject<ThermostatMode>;

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
                    name: 'BOOST',
                    valueType: ValueType.Boolean,
                    accessType: StateAccessType.ReadWrite,
                    type: PropertyType.Boost,
                    callback: state => (this.#boostState = state),
                },
                {
                    name: 'PARTY',
                    valueType: ValueType.Boolean,
                    accessType: StateAccessType.ReadWrite,
                    type: PropertyType.Party,
                    callback: state => (this.#partyState = state),
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

    getModes(): ThermostatMode[] {
        if (!this.#modeState) {
            throw new Error('Mode state not found');
        }
        return this.#modeState.getModes();
    }

    updateModes(modes: { [key: string]: ThermostatMode }): Promise<void> {
        if (!this.#modeState) {
            throw new Error('Mode state not found');
        }
        return this.#modeState.updateModes(modes);
    }

    setMode(mode: ThermostatMode): Promise<void> {
        if (!this.#modeState) {
            throw new Error('Mode state not found');
        }
        return this.#modeState.setValue(mode);
    }

    getMode(): ThermostatMode | undefined {
        if (!this.#modeState) {
            throw new Error('Mode state not found');
        }
        return this.#modeState.value;
    }

    updateSetpointMinMax(min: number | undefined, max: number | undefined): Promise<void> {
        if (!this.#levelState) {
            throw new Error('Level state not found');
        }
        return this.#levelState.updateMinMax({ min, max });
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

    updateLevel(value: number): Promise<void> {
        if (!this.#levelState) {
            throw new Error('Level state not found');
        }
        return this.#levelState.updateValue(value);
    }

    getTemperature(): number | undefined {
        if (!this.#getTemperatureState) {
            throw new Error('Temperature state not found');
        }
        return this.#getTemperatureState.value;
    }

    updateTemperature(value: number): Promise<void> {
        if (!this.#getTemperatureState) {
            throw new Error('Temperature state not found');
        }
        return this.#getTemperatureState.updateValue(value);
    }

    getPower(): boolean | number | undefined {
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

    updatePower(value: boolean | number): Promise<void> {
        if (!this.#powerState) {
            throw new Error('Power state not found');
        }
        return this.#powerState.updateValue(value);
    }

    getHumidity(): number | undefined {
        if (!this.#getHumidityState) {
            throw new Error('Humidity state not found');
        }
        return this.#getHumidityState.value;
    }

    updateHumidity(value: number): Promise<void> {
        if (!this.#getHumidityState) {
            throw new Error('Humidity state not found');
        }
        return this.#getHumidityState.updateValue(value);
    }

    getBoost(): number | undefined {
        if (!this.#boostState) {
            throw new Error('Boost state not found');
        }
        return this.#boostState.value;
    }

    setBoost(value: number): Promise<void> {
        if (!this.#boostState) {
            throw new Error('Boost state not found');
        }
        return this.#boostState.setValue(value);
    }

    getParty(): boolean | number | undefined {
        if (!this.#partyState) {
            throw new Error('Party state not found');
        }
        return this.#partyState.value;
    }

    setParty(value: boolean | number): Promise<void> {
        if (!this.#partyState) {
            throw new Error('Party state not found');
        }
        return this.#partyState.setValue(value);
    }
}

export default Thermostat;
