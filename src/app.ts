import * as cdk from "monocdk";
import { KeukboundDeployer } from "./deployment";

const app = new cdk.App();

new KeukboundDeployer(app, "keuk");

app.synth();
