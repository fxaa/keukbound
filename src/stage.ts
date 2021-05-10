import * as cdk from "monocdk";
import { KeukboundServer } from "./server";

export class KeukboundStage extends cdk.Stage {
    constructor(parent: cdk.Construct, id: string, props?: cdk.StageProps) {
        super(parent, id);
        new KeukboundServer(this, "server-stack");
    }
}
