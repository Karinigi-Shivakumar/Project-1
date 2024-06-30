const { connectToDatabase } = require("../db/dbConnector");

exports.handler = async (event, context, callback) => {
	const projectId = event.queryStringParameters?.project_id ?? null;
	const client = await connectToDatabase();
	try {
		let query = `
					SELECT
						p.id AS project_id,
						(p.project->>'name') AS project_name,
						COUNT(u.id) AS usecase_count,
						COUNT(*) FILTER (WHERE u.usecase->>'status' = 'completed') AS completed
					FROM
						projects_table AS p
					LEFT JOIN
						usecases_table AS u ON p.id = u.project_id`;
		const queryParams = [];
		if (projectId !== null) {
			query += `
					WHERE
						p.id = $1`;
			queryParams.push(projectId);
		}
		query += `
					GROUP BY
						p.id`;
		const result = await client.query(query, queryParams);

		const usecaseOverview = result.rows.map(
			({ project_id, project_name, usecase_count, completed }) => ({
				project_id,
				project_name,
				completed: parseInt(completed),
				incomplete: usecase_count - completed,
			})
		);
		return {
			statusCode: 200,
			headers: {
				"Access-Control-Allow-Origin": "*",
			},
			body: JSON.stringify(Object.values(usecaseOverview)),
		};
	} catch (e) {
		return {
			statusCode: 500,
			headers: {
				"Access-Control-Allow-Origin": "*",
			},
			body: JSON.stringify({ error: e.message || "An error occurred" }),
		};
	} finally {
		client.end();
	}
};
