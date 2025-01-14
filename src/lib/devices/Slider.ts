import { type DeviceStateObject, PropertyType, ValueType } from './DeviceStateObject';
import GenericDevice, { type DetectedDevice, type DeviceOptions, StateAccessType } from './GenericDevice';

class Slider extends GenericDevice {
    #setLevelState?: DeviceStateObject<number>;
    #getLevelState?: DeviceStateObject<number>;

    constructor(detectedDevice: DetectedDevice, adapter: ioBroker.Adapter, options?: DeviceOptions) {
        super(detectedDevice, adapter, options);

        this._construction.push(
            this.addDeviceStates([
                // actual value first, as it will be read first
                {
                    name: 'ACTUAL',
                    valueType: ValueType.NumberPercent,
                    accessType: StateAccessType.Read,
                    type: PropertyType.Level,
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
}

export default Slider;
