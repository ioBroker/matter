import { type DeviceStateObject, PropertyType, ValueType } from './DeviceStateObject';
import ElectricityDataDevice from './ElectricityDataDevice';
import { type DetectedDevice, type DeviceOptions, StateAccessType } from './GenericDevice';

class Dimmer extends ElectricityDataDevice {
    #setLevelState?: DeviceStateObject<number>;
    #getLevelState?: DeviceStateObject<number>;
    #setPowerState?: DeviceStateObject<boolean>;
    #getPowerState?: DeviceStateObject<boolean>;
    #transitionTimeState?: DeviceStateObject<number>;
    #lastNotZeroLevel?: number;

    constructor(detectedDevice: DetectedDevice, adapter: ioBroker.Adapter, options?: DeviceOptions) {
        super(detectedDevice, adapter, options);

        this._construction.push(
            this.addDeviceStates([
                {
                    name: 'ACTUAL',
                    valueType: ValueType.NumberPercent,
                    accessType: StateAccessType.Read,
                    type: PropertyType.LevelActual,
                    callback: state => (this.#getLevelState = state),
                },
                {
                    name: 'SET',
                    valueType: ValueType.NumberPercent,
                    accessType: StateAccessType.ReadWrite,
                    type: PropertyType.Level,
                    callback: state => (this.#setLevelState = state),
                },
                {
                    name: 'ON_ACTUAL',
                    valueType: ValueType.Boolean,
                    accessType: StateAccessType.Read,
                    type: PropertyType.PowerActual,
                    callback: state => (this.#getPowerState = state),
                },
                {
                    name: 'ON_SET',
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

    getLevel(): number | undefined {
        if (!this.#setLevelState && !this.#getLevelState) {
            throw new Error('Level state not found');
        }

        if (this.options?.dimmerUseLastLevelForOn && (this.#getLevelState?.value || 0) > 10) {
            this.#lastNotZeroLevel = this.#getLevelState?.value || 100;
        }

        return (this.#getLevelState || this.#setLevelState)?.value;
    }

    setLevel(value: number): Promise<void> {
        if (!this.#setLevelState) {
            throw new Error('Level state not found');
        }
        return this.#setLevelState.setValue(value);
    }

    async updateLevel(value: number): Promise<void> {
        if (!this.#setLevelState && !this.#getLevelState) {
            throw new Error('Level state not found');
        }
        await this.#setLevelState?.updateValue(value);
        await this.#getLevelState?.updateValue(value);
    }

    getLevelActual(): number | undefined {
        if (!this.#getLevelState) {
            throw new Error('Level state not found');
        }
        return this.#getLevelState.value;
    }

    async updateLevelActual(value: number): Promise<void> {
        if (!this.#getLevelState) {
            throw new Error('Level state not found');
        }
        await this.#getLevelState.updateValue(value);
        await this.#setLevelState?.updateValue(value);
    }

    getPower(): boolean | undefined {
        if (!this.#getPowerState && !this.#setPowerState && !this.#setLevelState && !this.#getLevelState) {
            throw new Error('Power state not found');
        }
        if (this.#getPowerState || this.#setPowerState) {
            return (this.#getPowerState || this.#setPowerState)?.value;
        }
        const state = this.#getLevelState || this.#setLevelState;
        if (state) {
            return (state.value || 0) > 0;
        }
        return undefined;
    }

    setPower(value: boolean): Promise<void> {
        if (this.#setPowerState) {
            return this.#setPowerState.setValue(value);
        }
        if (this.#setLevelState) {
            if (value) {
                if (this.options?.dimmerUseLastLevelForOn) {
                    return this.#setLevelState.setValue(this.#lastNotZeroLevel || 100);
                }
                return this.#setLevelState.setValue(this.options?.dimmerOnLevel || 100);
            }
            if (this.options?.dimmerUseLastLevelForOn) {
                this.#lastNotZeroLevel = this.#getLevelState?.value || this.#lastNotZeroLevel || 100;
            }
            return this.#setLevelState.setValue(0);
        }
        throw new Error('Power state not found');
    }

    async updatePower(value: boolean): Promise<void> {
        if (!this.#setPowerState && !this.#getPowerState) {
            throw new Error('Power state not found');
        }
        await this.#setPowerState?.updateValue(value);
        await this.#getPowerState?.updateValue(value);
    }

    hasPower(): boolean {
        return !!this.#setPowerState;
    }

    getPowerActual(): boolean | undefined {
        if (!this.#getPowerState) {
            throw new Error('Power state not found');
        }
        return this.#getPowerState.value;
    }

    async updatePowerActual(value: boolean): Promise<void> {
        if (!this.#getPowerState) {
            throw new Error('Power state not found');
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

export default Dimmer;
