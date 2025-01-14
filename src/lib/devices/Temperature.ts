import { type DeviceStateObject, PropertyType, ValueType } from './DeviceStateObject';
import GenericDevice, { type DetectedDevice, type DeviceOptions, StateAccessType } from './GenericDevice';

class Temperature extends GenericDevice {
    #getTemperatureState?: DeviceStateObject<number>;
    #getHumidityState?: DeviceStateObject<number>;

    constructor(detectedDevice: DetectedDevice, adapter: ioBroker.Adapter, options?: DeviceOptions) {
        super(detectedDevice, adapter, options);

        this._construction.push(
            this.addDeviceStates([
                {
                    name: 'ACTUAL',
                    valueType: ValueType.Number,
                    accessType: StateAccessType.Read,
                    type: PropertyType.Temperature,
                    callback: state => (this.#getTemperatureState = state),
                    unitConversionMap: {
                        '°F': (value, toDefaultUnit) => (toDefaultUnit ? (value - 32) / 1.8 : value * 1.8 + 32),
                    },
                },
                {
                    name: 'SECOND',
                    valueType: ValueType.NumberPercent,
                    accessType: StateAccessType.Read,
                    type: PropertyType.Humidity,
                    callback: state => (this.#getHumidityState = state),
                },
            ]),
        );
    }

    getTemperature(): number | undefined {
        if (!this.#getTemperatureState) {
            throw new Error('Value state not found');
        }
        return this.#getTemperatureState.value;
    }

    updateTemperature(value: number): Promise<void> {
        if (!this.#getTemperatureState) {
            throw new Error('Value state not found');
        }
        return this.#getTemperatureState.updateValue(value);
    }

    hasHumidity(): boolean {
        return !!this.#getHumidityState;
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
}

export default Temperature;
