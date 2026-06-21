// Type declaration for @3d-dice/dice-box (no upstream @types package available).
declare module "@3d-dice/dice-box" {
  export interface DiceBoxConfig {
    assetPath?: string;
    theme?: string;
    gravity?: number;
    mass?: number;
    friction?: number;
    restitution?: number;
    angularDamping?: number;
    linearDamping?: number;
    settleTimeout?: number;
    offscreen?: boolean;
    delay?: number;
    startingHeight?: number;
    spinForce?: number;
    throwForce?: number;
    scale?: number;
    lightIntensity?: number;
    enableShadows?: boolean;
    shadowTransparency?: number;
  }

  export interface RollResult {
    qty: number;
    sides: number;
    modifier: number;
    rolls: number[];
    value: number;
  }

  export default class DiceBox {
    constructor(selector: string, config?: DiceBoxConfig);
    init(): Promise<void>;
    roll(notation: string): Promise<RollResult[]>;
    add(notation: string | object): Promise<RollResult[]>;
    clear(): void;
    hide(): void;
    show(): void;
    updateConfig(config: Partial<DiceBoxConfig>): void;
  }
}
