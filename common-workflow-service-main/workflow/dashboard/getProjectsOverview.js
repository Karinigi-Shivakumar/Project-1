const { connectToDatabase } = require("../db/dbConnector");
const { z } = require("zod");

exports.handler = async (event) => {
	const status = event.queryStringParameters?.status ?? null;
	const validStatusValues = ["unassigned", "completed", "inprogress"]
	const statusSchema = z.string().nullable().refine((value) => value === null || validStatusValues.includes(value), {
		message: "Invalid status value",
	}); 
	const isValidStatus = statusSchema.safeParse(status)
	if(!isValidStatus.success){
		return {
			statusCode: 400,
			headers: {
				"Access-Control-Allow-Origin": "*",
			},
			body: JSON.stringify({
				error: isValidStatus.error.issues[0].message
			}),
		};
	}
	const client = await connectToDatabase();
	try {
		let query = `
					select 
						p.id as project_id,
						(p.project->>'name') as project_name,
						(p.project->>'status') as status,
						(p.project->>'end_date') as due_date,
						COUNT(distinct u.id) as total_usecases,
						COUNT(t.id) as total_tasks,
						COUNT(t.id) FILTER (WHERE t.task->>'status' = 'completed') as tasks_completed
						from projects_table as p 
					left join
						usecases_table as u on p.id = u.project_id 
					left join
						tasks_table as t on u.id = t.usecase_id and p.id = t.project_id`;
         const queryParams = []
		if (status !== null) {
			query += `
                    where
                        (p.project->>'status' = $1)`;
                        queryParams.push(status)
		}
		query += `
                    group by 
                        p.id`;
		const result = await client.query(query, queryParams);
		const projectsOverview = result.rows.map(
			({
				project_id,
				project_name,
				status,
				due_date,
				total_usecases,
				total_tasks,
				tasks_completed,
			}) => ({
				project_id,
				project_name,
				status,
                total_usecases : parseInt(total_usecases),
				due_date,
				completed_tasks_percentage: (total_tasks != 0) ? Math.round((tasks_completed / total_tasks) * 100) : 0
			})
		);
		return {
			statusCode: 200,
			headers: {
				"Access-Control-Allow-Origin": "*",
			},
			body: JSON.stringify(projectsOverview),
		};
	} catch (error) {
		return {
			statusCode: 500,
			headers: {
				"Access-Control-Allow-Origin": "*",
			},
			body: JSON.stringify({
				message: e.message,
				error : e
			}),
		};
	} finally {
		await client.end();
	}
};
