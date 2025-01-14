import { Behavior } from '@matter/main';
import type GenericDevice from '../../lib/devices/GenericDevice';
import type { MatterAdapter } from '../../main';

export class IoBrokerContextBehavior extends Behavior {
    static override readonly id = 'ioBrokerContext';
    declare state: IoBrokerContextBehavior.State;

    override initialize(): void {
        if (!this.state.adapter) {
            throw new Error('Adapter not set');
        }
        if (!this.state.device) {
            throw new Error('Device not set');
        }
    }
}

// eslint-disable-next-line @typescript-eslint/no-namespace
export namespace IoBrokerContextBehavior {
    export class State {
        adapter!: MatterAdapter;
        device!: GenericDevice;
    }
}
