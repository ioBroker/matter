import { type DeviceStateObject, PropertyType, ValueType } from './DeviceStateObject';
import GenericDevice, { type DetectedDevice, type DeviceOptions, StateAccessType } from './GenericDevice';

class Humidity extends GenericDevice {
    #getHumidityState?: DeviceStateObject<number>;

    constructor(detectedDevice: DetectedDevice, adapter: ioBroker.Adapter, options?: DeviceOptions) {
        super(detectedDevice, adapter, options);

        this._construction.push(
            this.addDeviceStates([
                {
                    name: 'ACTUAL',
                    valueType: ValueType.NumberPercent,
                    accessType: StateAccessType.Read,
                    type: PropertyType.Humidity,
                    callback: state => (this.#getHumidityState = state),
                },
            ]),
        );
    }

    getHumidity(): number | undefined {
        if (!this.#getHumidityState) {
            throw new Error('Value state not found');
        }
        return this.#getHumidityState.value;
    }

    updateHumidity(value: number): Promise<void> {
        if (!this.#getHumidityState) {
            throw new Error('Value state not found');
        }
        return this.#getHumidityState.updateValue(value);
    }
}

export default Humidity;
