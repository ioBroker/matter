import { type DeviceStateObject, PropertyType, ValueType } from './DeviceStateObject';
import GenericDevice, { type DetectedDevice, type DeviceOptions, StateAccessType } from './GenericDevice';

/*
*	FILE	camera	file				/^camera(\.\w+)?$/
AUTOFOCUS	switch.camera.autofocus	boolean	W			/^switch(\.camera)?\.autofocus$/
AUTOWHITEBALANCE	switch.camera.autowhitebalance	boolean	W			/^switch(\.camera)?\.autowhitebalance$/
BRIGHTNESS	switch.camera.brightness	boolean	W			/^switch(\.camera)?\.brightness$/
NIGHTMODE	switch.camera.nightmode	boolean	W			/^switch(\.camera)?\.nightmode$/
PTZ	level.camera.position	number	W			/^level(\.camera)?\.position$｜^level(\.camera)?(\.ptz)$/
*/

class Camera extends GenericDevice {
    #getFileState?: DeviceStateObject<string>;
    #autoFocusState?: DeviceStateObject<boolean>;
    #autoWhiteBalanceState?: DeviceStateObject<boolean>;
    #brightnessState?: DeviceStateObject<boolean>;
    #nightModeState?: DeviceStateObject<boolean>;
    #ptzState?: DeviceStateObject<number>;

    constructor(detectedDevice: DetectedDevice, adapter: ioBroker.Adapter, options?: DeviceOptions) {
        super(detectedDevice, adapter, options);

        this._construction.push(
            this.addDeviceStates([
                {
                    name: 'FILE',
                    valueType: ValueType.String,
                    accessType: StateAccessType.Read,
                    type: PropertyType.File,
                    callback: state => (this.#getFileState = state),
                },
                {
                    name: 'AUTOFOCUS',
                    valueType: ValueType.Boolean,
                    accessType: StateAccessType.ReadWrite,
                    type: PropertyType.AutoFocus,
                    callback: state => (this.#autoFocusState = state),
                },
                {
                    name: 'AUTOWHITEBALANCE',
                    valueType: ValueType.Boolean,
                    accessType: StateAccessType.ReadWrite,
                    type: PropertyType.AutoWhiteBalance,
                    callback: state => (this.#autoWhiteBalanceState = state),
                },
                {
                    name: 'BRIGHTNESS',
                    valueType: ValueType.Boolean,
                    accessType: StateAccessType.ReadWrite,
                    type: PropertyType.Brightness,
                    callback: state => (this.#brightnessState = state),
                },
                {
                    name: 'NIGHTMODE',
                    valueType: ValueType.Boolean,
                    accessType: StateAccessType.ReadWrite,
                    type: PropertyType.NightMode,
                    callback: state => (this.#nightModeState = state),
                },
                {
                    name: 'PTZ',
                    valueType: ValueType.Number,
                    accessType: StateAccessType.ReadWrite,
                    type: PropertyType.PTZ,
                    callback: state => (this.#ptzState = state),
                },
            ]),
        );
    }

    getFile(): string | undefined {
        if (!this.#getFileState) {
            throw new Error('File state not found');
        }
        return this.#getFileState.value;
    }

    getAutoFocus(): boolean | undefined {
        if (!this.#autoFocusState) {
            throw new Error('AutoFocus state not found');
        }
        return this.#autoFocusState.value;
    }

    setAutoFocus(value: boolean): Promise<void> {
        if (!this.#autoFocusState) {
            throw new Error('AutoFocus state not found');
        }
        return this.#autoFocusState.setValue(value);
    }

    getAutoWhiteBalance(): boolean | undefined {
        if (!this.#autoWhiteBalanceState) {
            throw new Error('AutoWhiteBalance state not found');
        }
        return this.#autoWhiteBalanceState.value;
    }

    setAutoWhiteBalance(value: boolean): Promise<void> {
        if (!this.#autoWhiteBalanceState) {
            throw new Error('AutoWhiteBalance state not found');
        }
        return this.#autoWhiteBalanceState.setValue(value);
    }

    getBrightness(): boolean | undefined {
        if (!this.#brightnessState) {
            throw new Error('Brightness state not found');
        }
        return this.#brightnessState.value;
    }

    setBrightness(value: boolean): Promise<void> {
        if (!this.#brightnessState) {
            throw new Error('Brightness state not found');
        }
        return this.#brightnessState.setValue(value);
    }

    getNightMode(): boolean | undefined {
        if (!this.#nightModeState) {
            throw new Error('NightMode state not found');
        }
        return this.#nightModeState.value;
    }

    setNightMode(value: boolean): Promise<void> {
        if (!this.#nightModeState) {
            throw new Error('NightMode state not found');
        }
        return this.#nightModeState.setValue(value);
    }

    getPtz(): number | undefined {
        if (!this.#ptzState) {
            throw new Error('PTZ state not found');
        }
        return this.#ptzState.value;
    }

    setPtz(value: number): Promise<void> {
        if (!this.#ptzState) {
            throw new Error('PTZ state not found');
        }
        return this.#ptzState.setValue(value);
    }
}

export default Camera;
