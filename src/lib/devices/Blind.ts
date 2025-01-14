import BlindButtons from './BlindButtons';
import { type DeviceStateObject, PropertyType, ValueType } from './DeviceStateObject';
import { type DetectedDevice, type DeviceOptions, StateAccessType } from './GenericDevice';

class Blind extends BlindButtons {
    #setLevelState?: DeviceStateObject<number>;
    #getLevelState?: DeviceStateObject<number>;

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
            ]),
        );
    }

    getLevel(): number | undefined {
        if (!this.#setLevelState && !this.#getLevelState) {
            throw new Error('Level state not found');
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
}

export default Blind;
