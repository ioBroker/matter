import Ct from './Ct';
import { type DeviceStateObject, PropertyType, ValueType } from './DeviceStateObject';
import { type DetectedDevice, type DeviceOptions, StateAccessType } from './GenericDevice';

class RgbSingle extends Ct {
    #rgb?: DeviceStateObject<string>;

    constructor(detectedDevice: DetectedDevice, adapter: ioBroker.Adapter, options?: DeviceOptions) {
        super(detectedDevice, adapter, options);

        this._construction.push(
            this.addDeviceStates([
                {
                    name: 'RGB',
                    valueType: ValueType.String,
                    accessType: StateAccessType.ReadWrite,
                    type: PropertyType.Rgb,
                    callback: state => (this.#rgb = state),
                },
            ]),
        );
    }

    getRgb(): string | undefined {
        if (!this.#rgb) {
            throw new Error('RGB state not found');
        }
        return this.#rgb.value;
    }

    setRgb(value: string): Promise<void> {
        if (!this.#rgb) {
            throw new Error('RGB state not found');
        }
        return this.#rgb.setValue(value);
    }
}

export default RgbSingle;
