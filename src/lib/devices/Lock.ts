import { type DeviceStateObject, PropertyType, ValueType } from './DeviceStateObject';
import GenericDevice, { type DetectedDevice, type DeviceOptions, StateAccessType } from './GenericDevice';

class Lock extends GenericDevice {
    #setLockState?: DeviceStateObject<boolean>;
    #getLockState?: DeviceStateObject<boolean>;
    #setOpenState?: DeviceStateObject<boolean>;

    constructor(detectedDevice: DetectedDevice, adapter: ioBroker.Adapter, options?: DeviceOptions) {
        super(detectedDevice, adapter, options);

        this._construction.push(
            this.addDeviceStates([
                // actual value first, as it will be read first
                {
                    name: 'ACTUAL',
                    valueType: ValueType.Boolean,
                    accessType: StateAccessType.Read,
                    type: PropertyType.LockStateActual,
                    callback: state => (this.#getLockState = state),
                },
                {
                    name: 'SET',
                    valueType: ValueType.Boolean,
                    accessType: StateAccessType.ReadWrite,
                    type: PropertyType.LockState,
                    callback: state => (this.#setLockState = state),
                },
                {
                    name: 'OPEN',
                    valueType: ValueType.Button,
                    accessType: StateAccessType.Write,
                    type: PropertyType.Open,
                    callback: state => (this.#setOpenState = state),
                },
            ]),
        );
    }

    getLockState(): boolean | undefined {
        if (!this.#getLockState && !this.#setLockState) {
            throw new Error('Level state not found');
        }
        return (this.#getLockState || this.#setLockState)?.value;
    }

    setLockState(value: boolean): Promise<void> {
        if (!this.#setLockState) {
            throw new Error('Level state not found');
        }
        return this.#setLockState.setValue(value);
    }

    async updateLockState(value: boolean): Promise<void> {
        if (!this.#getLockState && !this.#setLockState) {
            throw new Error('Level state not found');
        }
        await this.#getLockState?.updateValue(value);
        await this.#setLockState?.updateValue(value);
    }

    getLockStateActual(): boolean | undefined {
        if (!this.#getLockState) {
            throw new Error('Level state not found');
        }
        return this.#getLockState.value;
    }

    async updateLockStateActual(value: boolean): Promise<void> {
        if (!this.#getLockState) {
            throw new Error('Level state not found');
        }
        await this.#getLockState.updateValue(value);
        await this.#setLockState?.updateValue(value);
    }

    setOpen(): Promise<void> {
        if (!this.#setOpenState) {
            throw new Error('Open state not found');
        }
        return this.#setOpenState.setValue(true);
    }

    hasOpen(): boolean {
        return !!this.#setOpenState;
    }
}

export default Lock;
