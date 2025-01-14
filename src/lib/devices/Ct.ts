import { type DeviceStateObject, PropertyType, ValueType } from './DeviceStateObject';
import ElectricityDataDevice from './ElectricityDataDevice';
import { type DetectedDevice, type DeviceOptions, StateAccessType } from './GenericDevice';

class Ct extends ElectricityDataDevice {
    #dimmerState?: DeviceStateObject<number>;
    #brightnessState?: DeviceStateObject<number>;
    #temperatureState?: DeviceStateObject<number>;
    #setPowerState?: DeviceStateObject<boolean>;
    #getPowerState?: DeviceStateObject<boolean>;
    #transitionTimeState?: DeviceStateObject<number>;

    constructor(detectedDevice: DetectedDevice, adapter: ioBroker.Adapter, options?: DeviceOptions) {
        super(detectedDevice, adapter, options);

        this._construction.push(
            this.addDeviceStates([
                {
                    name: 'DIMMER',
                    valueType: ValueType.NumberPercent,
                    accessType: StateAccessType.ReadWrite,
                    type: PropertyType.Dimmer,
                    callback: state => (this.#dimmerState = state),
                },
                {
                    name: 'BRIGHTNESS',
                    valueType: ValueType.NumberPercent,
                    accessType: StateAccessType.ReadWrite,
                    type: PropertyType.Brightness,
                    callback: state => (this.#brightnessState = state),
                },
                {
                    name: 'TEMPERATURE',
                    valueType: ValueType.NumberMinMax,
                    accessType: StateAccessType.ReadWrite,
                    type: PropertyType.Temperature,
                    callback: state => (this.#temperatureState = state),
                    unitConversionMap: {
                        mireds: value => Math.round(1_000_000 / value),
                    },
                },
                // actual value first, as it will be read first
                {
                    name: 'ON_ACTUAL',
                    valueType: ValueType.Boolean,
                    accessType: StateAccessType.Read,
                    type: PropertyType.PowerActual,
                    callback: state => (this.#getPowerState = state),
                },
                {
                    name: 'ON',
                    valueType: ValueType.Boolean,
                    accessType: StateAccessType.ReadWrite,
                    type: PropertyType.Power,
                    callback: state => (this.#setPowerState = state),
                },
                {
                    name: 'TRANSITION_TIME',
                    valueType: ValueType.Number,
                    accessType: StateAccessType.ReadWrite,
                    type: PropertyType.TransitionTime,
                    callback: state => (this.#transitionTimeState = state),
                    unitConversionMap: {
                        // Default is ms
                        s: (value: number, toDefaultUnit: boolean): number =>
                            toDefaultUnit ? value * 1000 : value * 0.001,
                    },
                },
            ]),
        );
    }

    getDimmer(): number | undefined {
        if (!this.#dimmerState) {
            if (!this.#brightnessState) {
                throw new Error('Dimmer state not found');
            }
            return this.#brightnessState.value;
        }
        return this.#dimmerState.value;
    }

    updateDimmer(value: number): Promise<void> {
        if (!this.#dimmerState) {
            if (!this.#brightnessState) {
                throw new Error('Dimmer state not found');
            }
            return this.#brightnessState.updateValue(value);
        }
        return this.#dimmerState.updateValue(value);
    }

    setDimmer(value: number): Promise<void> {
        if (!this.#dimmerState) {
            if (!this.#brightnessState) {
                throw new Error('Dimmer state not found');
            }
            return this.#brightnessState.setValue(value);
        }
        return this.#dimmerState.setValue(value);
    }

    hasDimmer(): boolean {
        return !!this.#dimmerState || !!this.#brightnessState;
    }

    getBrightness(): number | undefined {
        if (!this.#brightnessState) {
            throw new Error('Brightness state not found');
        }
        return this.#brightnessState.value;
    }

    updateBrightness(value: number): Promise<void> {
        if (!this.#brightnessState) {
            throw new Error('Brightness state not found');
        }
        return this.#brightnessState.updateValue(value);
    }

    setBrightness(value: number): Promise<void> {
        if (!this.#brightnessState) {
            throw new Error('Brightness state not found');
        }
        return this.#brightnessState.setValue(value);
    }

    getTemperature(): number | undefined {
        if (!this.#temperatureState) {
            throw new Error('Temperature state not found');
        }
        return this.#temperatureState.value;
    }

    getTemperatureMinMax(): { min: number; max: number } | null {
        if (!this.#temperatureState) {
            throw new Error('Temperature state not found');
        }
        return this.#temperatureState.getMinMax();
    }

    updateTemperature(value: number): Promise<void> {
        if (!this.#temperatureState) {
            throw new Error('Temperature state not found');
        }
        return this.#temperatureState.updateValue(value);
    }

    setTemperature(value: number): Promise<void> {
        if (!this.#temperatureState) {
            throw new Error('Temperature state not found');
        }
        return this.#temperatureState.setValue(value);
    }

    getPower(): boolean | undefined {
        if (!this.#getPowerState && !this.#setPowerState) {
            throw new Error('On state not found');
        }
        return (this.#getPowerState || this.#setPowerState)?.value;
    }

    setPower(value: boolean): Promise<void> {
        if (!this.#setPowerState) {
            throw new Error('On state not found');
        }
        return this.#setPowerState.setValue(value);
    }

    async updatePower(value: boolean): Promise<void> {
        if (!this.#getPowerState && !this.#setPowerState) {
            throw new Error('Power state not found');
        }
        await this.#getPowerState?.updateValue(value);
        await this.#setPowerState?.updateValue(value);
    }

    hasPower(): boolean {
        return !!this.#getPowerState;
    }

    getPowerActual(): boolean | undefined {
        if (!this.#getPowerState) {
            throw new Error('PowerActual state not found');
        }
        return this.#getPowerState.value;
    }

    async updatePowerActual(value: boolean): Promise<void> {
        if (!this.#getPowerState) {
            throw new Error('PowerActual state not found');
        }
        await this.#getPowerState.updateValue(value);
        await this.#setPowerState?.updateValue(value);
    }

    hasTransitionTime(): boolean {
        return !!this.#transitionTimeState;
    }

    getTransitionTime(): number | undefined {
        if (!this.#transitionTimeState) {
            throw new Error('TransitionTime state not found');
        }
        return this.#transitionTimeState.value;
    }

    setTransitionTime(value: number): Promise<void> {
        if (!this.#transitionTimeState) {
            throw new Error('TransitionTime state not found');
        }
        return this.#transitionTimeState.setValue(value);
    }

    updateTransitionTime(value: number): Promise<void> {
        if (!this.#transitionTimeState) {
            throw new Error('TransitionTime state not found');
        }
        return this.#transitionTimeState.updateValue(value);
    }
}

export default Ct;
