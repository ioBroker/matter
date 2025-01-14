import Ct from './Ct';
import { type DeviceStateObject, PropertyType, ValueType } from './DeviceStateObject';
import { type DetectedDevice, type DeviceOptions, StateAccessType } from './GenericDevice';

class RgbwSingle extends Ct {
    #rgbw?: DeviceStateObject<string>;

    constructor(detectedDevice: DetectedDevice, adapter: ioBroker.Adapter, options?: DeviceOptions) {
        super(detectedDevice, adapter, options);

        this._construction.push(
            this.addDeviceStates([
                {
                    name: 'RGBW',
                    valueType: ValueType.String,
                    accessType: StateAccessType.ReadWrite,
                    type: PropertyType.Rgbw,
                    callback: state => (this.#rgbw = state),
                },
            ]),
        );
    }

    getRgbw(): string | undefined {
        if (!this.#rgbw) {
            throw new Error('RGBW state not found');
        }
        return this.#rgbw.value;
    }

    setRgbw(value: string): Promise<void> {
        if (!this.#rgbw) {
            throw new Error('RGBW state not found');
        }
        return this.#rgbw.setValue(value);
    }
}

export default RgbwSingle;
