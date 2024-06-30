const { connectToDatabase } = require("../db/dbConnector")
const getMasterWorkflows = `  
			SELECT *
            FROM                            
            master_workflow `
exports.handler = async (event, context) => {
	context.callbackWaitsForEmptyEventLoop = false
	const client = await connectToDatabase()
	try{
	const masterWorkflowsResult = await client.query(getMasterWorkflows)
	return {
		statusCode: 200,
		headers: {
			"Access-Control-Allow-Origin": "*",
			"Access-Control-Allow-Credentials": true,
		},
		body: JSON.stringify(masterWorkflowsResult.rows),
	}
} catch (error) {
	console.error("Error executing query", error);
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
} finally {
	await client.end();
}
};
