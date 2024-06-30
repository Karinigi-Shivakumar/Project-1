const { connectToDatabase } = require("../db/dbConnector");
exports.handler = async (event) => {
	const name = event.queryStringParameters?.name;
	const projectId = event.queryStringParameters?.project_id ?? null;
	const client = await connectToDatabase();
	try {
		let result = await client.query(
			                   `
								SELECT
								r.id AS resource_id,
								COALESCE(r.first_name || ' ' || r.last_name, '') AS resource_name,
								r.image AS image_url,
								r.work_email AS email
							FROM 
								employee AS r
							WHERE 
								LOWER(r.first_name || ' ' || r.last_name) LIKE LOWER('%' || $1 || '%')
							`,
			[name]
		);
		const resource = result.rows.map(
			({ resource_id, resource_name, image_url, email }) => ({
				resource_id,
				resource_name,
				image_url,
				email,
			})
		);
		return {
			statusCode: 200,
			headers: {
				"Access-Control-Allow-Origin": "*",
			},
			body: JSON.stringify(resource),
		};
	} catch (error) {
		console.error("error", error);
		return {
			statusCode: 500,
			headers: {
				"Access-Control-Allow-Origin": "*",
			},
			body: JSON.stringify({ message: "Internal server error" }),
		};
	} finally {
		await client.end();
	}
};