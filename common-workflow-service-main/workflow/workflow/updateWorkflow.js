const { connectToDatabase } = require("../db/dbConnector");
const { SFNClient, UpdateStateMachineCommand } = require("@aws-sdk/client-sfn");
const { generateStateMachine2 } = require("./generateStateMachine");
const { z } = require("zod");

exports.handler = async (event) => {
	const id = event.pathParameters?.id;
	const { updated_by_id, stages } = JSON.parse(event.body);
    const IdSchema = z.string().uuid({ message: "Invalid id" });
    const isUuid = IdSchema.safeParse(id);
    const isUuid1 = IdSchema.safeParse(updated_by_id);
    if (
        !isUuid.success ||
        !isUuid1.success ||
        (!isUuid.success && !isUuid1.success)
    ) {
        const error =
            (isUuid.success ? "" : isUuid.error.issues[0].message) +
            (isUuid1.success ? "" : isUuid1.error.issues[0].message);
        return {
            statusCode: 400,
            headers: {
               "Access-Control-Allow-Origin": "*",
				"Access-Control-Allow-Credentials": true,
            },
            body: JSON.stringify({
                error: error,
            }),
        };
    }
	const StageSchema = z.object(
        {
            tasks: z.array(z.string()),
            checklist: z.array(z.string()),
        },
        { message: "Invalid request body" }
    );
    const MetaDataSchema = z.array(z.record(z.string(), StageSchema))
	const metadataresult = MetaDataSchema.safeParse(stages)
		if (!metadataresult.success) {
		return {
			statusCode: 400,
			headers: {
				"Access-Control-Allow-Origin": "*",
			},
			body: JSON.stringify({
				error: metadataresult.error.formErrors.fieldErrors,
			}),
		};
	}
	const sfnClient = new SFNClient({ region: "us-east-1" });
	const client = await connectToDatabase();
	try {
		const workflowData = await client.query(
			`select arn, metadata from workflows_table where id = $1`,
			[id]
		);

		const metaData = workflowData.rows[0].metadata;
		const newStateMachine = generateStateMachine2(stages);

		const input = {
			stateMachineArn: workflowData.rows[0].arn,
			definition: JSON.stringify(newStateMachine),
			roleArn: "arn:aws:iam::657907747545:role/backendstepfunc-Role",
		};
		const command = new UpdateStateMachineCommand(input);
		const commandResponse = await sfnClient.send(command);

		const resource = await client.query(
			`SELECT (r.resource -> 'name') as name,
                    (r.resource -> 'image') as image_url
            FROM employee as r
            WHERE id = $1`,
			[updated_by_id]
		);

		metaData.stages = stages;
		metaData.updated_by = {
			id: updated_by_id,
			name: resource.rows[0].name,
			image_url: resource.rows[0].image_url,
		};
		metaData.updated_time = commandResponse.updateDate;
		let query = `
            UPDATE workflows_table SET metadata = $1 WHERE id = $2
        	returning metadata->'stages' AS stages`;

		const result = await client.query(query, [metaData, id]);

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
					error: "Workflow with same name already exists",
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
