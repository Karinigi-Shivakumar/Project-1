const { connectToDatabase } = require("../db/dbConnector");
const { SFNClient, CreateStateMachineCommand } = require("@aws-sdk/client-sfn");
const { generateStateMachine1 } = require("./generateStateMachine");
const { z } = require("zod");
const { v4: uuid} = require("uuid")
 
exports.handler = async (event) => {
    let { name, created_by_id, project_id, stages} = JSON.parse(event.body);

    const projectIdSchema = z.string().uuid({ message: "Invalid project id" });
    const nameVal = z
        .string()
        .regex(/^[^-]*$/, {
            message: "name should not contain `-`",
        })
        .min(3)
        .safeParse(name);
    if (!nameVal.success) {
        return {
            statusCode: 400,
            headers: {
                "Access-Control-Allow-Origin": "*",
            },
            body: JSON.stringify({
                error: nameVal.error.issues[0].message,
            }),
        };
    }
    const isUuid = projectIdSchema.safeParse(project_id);
    if (!isUuid.success) {
        return {
            statusCode: 400,
            headers: {
                "Access-Control-Allow-Origin": "*",
            },
            body: JSON.stringify({
                error: isUuid.error.issues[0].message,
            }),
        };
    }
    const StageSchema = z.array(
        z.object({
            name: z
                .string({
                    message: "name must be atleast 3 characters",
                })
                .min(3),
            tasks: z.array(z.string()),
            checklist: z.array(z.string()),
        }),
        { message: "Invalid request body" }
    );
    const MetaDataSchema = z.object({
        status: z.string(),
        created_by: z.string().uuid({ message: "Invalid resource id" }),
        updated_by: z.string().uuid({ message: "Invalid resource id" }),
        stages: StageSchema,
    });
    const metaData = {
        status: "inprogress",
        created_by: created_by_id,
        updated_by: created_by_id,
        stages: stages,
    };
    const parseResult = MetaDataSchema.safeParse(metaData);
    if (!parseResult.success) {
        return {
            statusCode: 400,
            headers: {
                "Access-Control-Allow-Origin": "*",
            },
            body: JSON.stringify({
                error: parseResult.error.formErrors.fieldErrors,
            }),
        };
    }
    const sfnClient = new SFNClient({ region: "us-east-1" });
    const newStateMachine = generateStateMachine1(stages);
 
    const client = await connectToDatabase();
    try {
        const projectQueryPromise = client.query(
            `select * from projects_table where id = $1`,
            [project_id]
        );
        const workflowQueryPromise = client.query(
            `SELECT COUNT(*) FROM workflows_table WHERE LOWER(SUBSTRING(name, POSITION('-' IN name) + 1)) = LOWER($1);;`,
            [name]
        );
 
        const [projectResult, workflowExists] = await Promise.all([
            projectQueryPromise,
            workflowQueryPromise,
        ]);
        if (workflowExists.rows[0].count > 0) {
            return {
                statusCode: 400,
                headers: {
                    "Access-Control-Allow-Origin": "*",
                },
                body: JSON.stringify({
                    message: "workflow with same name already exists",
                }),
            };
        }
        const random = uuid().split('-')[4]
        const workflowName = random+"@"+name.replace(/ /g,"_");
        const input = {
            name: workflowName,
            definition: JSON.stringify(newStateMachine),
            roleArn: "arn:aws:iam::657907747545:role/backendstepfunc-Role",
        };
        const command = new CreateStateMachineCommand(input);
        const commandResponse = await sfnClient.send(command);
        metaData.created_time = new Date().toISOString();
        let query = `
                    insert into workflows_table
                    (name, arn, metadata, project_id) values ($1, $2, $3::jsonb, $4::uuid)
                    returning *`;
 
        const result = await client.query(query, [
            workflowName,
            commandResponse.stateMachineArn,
            metaData,
            project_id,
        ]);
        if (commandResponse.$metadata.httpStatusCode != 200) {
            console.log(JSON.stringify(commandResponse));
        }
        return {
            statusCode: 200,
            headers: {
                "Access-Control-Allow-Origin": "*",
            },
            body: JSON.stringify(result.rows[0]),
        };
    } catch (error) {
        if (error.name == "StateMachineAlreadyExists") {
            return {
                statusCode: 500,
                headers: {
                    "Access-Control-Allow-Origin": "*",
                },
                body: JSON.stringify({
                    message: "workflow with same name already exists",
                    error: error,
                }),
            };
        }
        return {
            statusCode: 500,
            headers: {
                "Access-Control-Allow-Origin": "*",
            },
            body: JSON.stringify({
                message: error.message,
                error: error,
            }),
        };
    }
    finally {
		await client.end();
	}
};
