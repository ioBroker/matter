import Ct from './Ct';
import { type DeviceStateObject, PropertyType, ValueType } from './DeviceStateObject';
import { type DetectedDevice, type DeviceOptions, StateAccessType } from './GenericDevice';

class Cie extends Ct {
    #cie?: DeviceStateObject<string>;

    // CIE has form lab(29.2345% 39.3825 20.0664);
    constructor(detectedDevice: DetectedDevice, adapter: ioBroker.Adapter, options?: DeviceOptions) {
        super(detectedDevice, adapter, options);

        this._construction.push(
            this.addDeviceStates([
                {
                    name: 'CIE',
                    valueType: ValueType.String,
                    accessType: StateAccessType.ReadWrite,
                    type: PropertyType.Cie,
                    callback: state => (this.#cie = state),
                },
            ]),
        );
    }

    getCie(): string | undefined {
        if (!this.#cie) {
            throw new Error('CIE state not found');
        }
        return this.#cie.value;
    }

    getXy(): { x: number; y: number } | undefined {
        if (!this.#cie) {
            throw new Error('CIE state not found');
        }
        const value = this.#cie.value;
        if (value?.startsWith('[') && value?.endsWith(']')) {
            try {
                const xy = value.substring(1, value.length - 1).split(',');
                return { x: parseFloat(xy[0]), y: parseFloat(xy[1]) };
            } catch {
                return undefined;
            }
        }
        return undefined;
    }

    setCie(value: string): Promise<void> {
        if (!this.#cie) {
            throw new Error('CIE state not found');
        }
        return this.#cie.setValue(value);
    }

    setXy(x: number, y: number): Promise<void> {
        if (!this.#cie) {
            throw new Error('CIE state not found');
        }
        return this.#cie.setValue(`[${x},${y}]`);
    }

    setX(x: number): Promise<void> {
        if (!this.#cie) {
            throw new Error('CIE state not found');
        }
        return this.#cie.setValue(`[${x},${this.getXy()?.y}]`);
    }

    setY(y: number): Promise<void> {
        if (!this.#cie) {
            throw new Error('CIE state not found');
        }
        return this.#cie.setValue(`[${this.getXy()?.x},${y}]`);
    }

    updateCie(value: string): Promise<void> {
        if (!this.#cie) {
            throw new Error('CIE state not found');
        }
        return this.#cie.updateValue(value);
    }

    updateXy(x: number, y: number): Promise<void> {
        if (!this.#cie) {
            throw new Error('CIE state not found');
        }
        return this.#cie.updateValue(`[${x},${y}]`);
    }

    updateX(x: number): Promise<void> {
        if (!this.#cie) {
            throw new Error('CIE state not found');
        }
        return this.#cie.updateValue(`[${x},${this.getXy()?.y}]`);
    }

    updateY(y: number): Promise<void> {
        if (!this.#cie) {
            throw new Error('CIE state not found');
        }
        return this.#cie.updateValue(`[${this.getXy()?.x},${y}]`);
    }
}

export default Cie;
