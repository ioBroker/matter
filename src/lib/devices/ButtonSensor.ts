import { type DeviceStateObject, PropertyType, ValueType } from './DeviceStateObject';
import GenericDevice, { type DetectedDevice, type DeviceOptions, StateAccessType } from './GenericDevice';

class ButtonSensor extends GenericDevice {
    #setPressState?: DeviceStateObject<boolean>;
    #setPressLongState?: DeviceStateObject<boolean>;

    constructor(detectedDevice: DetectedDevice, adapter: ioBroker.Adapter, options?: DeviceOptions) {
        super(detectedDevice, adapter, options);

        this._construction.push(
            this.addDeviceStates([
                {
                    name: 'PRESS',
                    valueType: ValueType.Button,
                    accessType: StateAccessType.Read,
                    type: PropertyType.Press,
                    callback: state => (this.#setPressState = state),
                },
                {
                    name: 'PRESS_LONG',
                    valueType: ValueType.Button,
                    accessType: StateAccessType.Read,
                    type: PropertyType.PressLong,
                    callback: state => (this.#setPressLongState = state),
                },
            ]),
        );
    }

    getPress(): boolean | undefined {
        if (!this.#setPressState) {
            throw new Error('Press state not found');
        }
        return this.#setPressState.value;
    }

    updatePress(): Promise<void> {
        if (!this.#setPressState) {
            throw new Error('Press state not found');
        }
        return this.#setPressState.updateValue(true);
    }

    hasPressLong(): boolean {
        return !!this.#setPressLongState;
    }

    getPressLong(): boolean | undefined {
        if (!this.#setPressLongState) {
            throw new Error('PressLong state not found');
        }
        return this.#setPressLongState.value;
    }

    updatePressLong(): Promise<void> {
        if (!this.#setPressLongState) {
            throw new Error('PressLong state not found');
        }
        return this.#setPressLongState.updateValue(true);
    }
}

export default ButtonSensor;
