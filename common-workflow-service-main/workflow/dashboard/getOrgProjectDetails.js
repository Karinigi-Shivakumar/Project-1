const { connectToDatabase } = require("../db/dbConnector");
exports.handler = async (event, context, callback) => {
    const client = await connectToDatabase();
	try {
		const total_projects_result = await client.query(`
            SELECT
                COUNT(*) AS total_projects
            FROM
                projects_table
        `);
        const total_projects = total_projects_result.rows[0].total_projects;

        const total_tasks_result = await client.query(`
            SELECT
                COUNT(DISTINCT id) AS task_count
            FROM
                tasks_table
        `);
        const total_tasks = total_tasks_result.rows[0].task_count;

        const projectByStatusQuery = `SELECT 
                                        COUNT(*) AS count,
                                        (project->>'status') AS status
                                    FROM
                                        projects_table
                                    GROUP BY
                                        project->>'status'`;

        const projectByStatusResult = await client.query(projectByStatusQuery);
        const projects_by_status = {};
        projectByStatusResult.rows.forEach((row) => {
            const status = row.status;
            const count = row.count;
	            projects_by_status[status] = parseInt(count);
        });
        const percentage_completed = Math.round((projects_by_status.completed/total_projects)*100);
		return {
			statusCode: 200,
			headers: {
				"Access-Control-Allow-Origin": "*",
			},
			body: JSON.stringify({
				total_projects : parseInt(total_projects),
                total_tasks: parseInt(total_tasks),
                percentage_completed: isNaN(percentage_completed) ? 0 : percentage_completed,
                completed: projects_by_status.completed || 0,
                in_progress: projects_by_status.inprogress || 0,
                unassigned: projects_by_status.unassigned || 0
			}),
		};
	} catch (error) {
		return {
			statusCode: 500,
			body: JSON.stringify({
				message: "Internal Server Error",
				error: error.message,
			}),
		};
	} finally {
		await client.end();
	}
};
