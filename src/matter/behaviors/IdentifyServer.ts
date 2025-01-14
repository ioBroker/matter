import { IdentifyServer } from '@matter/main/behaviors';

export class LoggingIdentifyServer extends IdentifyServer {}

export class LightingIdentifyServer extends IdentifyServer {
    override triggerEffect(): void {
        // TODO
    }
}
