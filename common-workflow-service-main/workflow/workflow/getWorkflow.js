const { connectToDatabase } = require("../db/dbConnector");
const { z } = require("zod");

exports.handler = async (event) => {
	const id = event.pathParameters?.id;
    const IdSchema = z.string().uuid({ message: "Invalid id" });
    const isUuid = IdSchema.safeParse(id);
	if (!isUuid.success) {
		return {
			statusCode: 400,
			headers: {
                "Access-Control-Allow-Origin": "*",
				"Access-Control-Allow-Credentials": true,
			},
			body: JSON.stringify({
				error: isUuid.error.issues[0].message,
			}),
		};
	}
	const client = await connectToDatabase();
	try {
		const workflowQuery = await client.query(
			`select * from workflows_table where id = $1`,
			[id]
		);
        const data = workflowQuery.rows[0]
        const res = {
            ...data,
			name : name.split('@')[1].replace(/_/g," "),
            arn: undefined
        }
		return {
			statusCode: 200,
			headers: {
                "Access-Control-Allow-Origin": "*",
				"Access-Control-Allow-Credentials": true,
			},
			body: JSON.stringify(res),
		};
	} catch (error) {
		return {
			statusCode: 500,
			headers: {
                "Access-Control-Allow-Origin": "*",
				"Access-Control-Allow-Credentials": true,
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
