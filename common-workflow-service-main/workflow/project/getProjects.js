const { connectToDatabase } = require("../db/dbConnector");
const { z } = require("zod");

exports.handler = async (event) => {
	let page = event.queryStringParameters?.page ?? null
	if (page == null) {
		page = 1
	}
	page = parseInt(page)
	const limit = 10
	let offset = (page - 1) * 10
	offset = Math.max(offset, 0)

	const status = event.queryStringParameters?.status ?? null;
	const validStatusValues = ["unassigned", "completed", "inprogress"];
	const statusSchema = z
		.string()
		.nullable()
		.refine(
			(value) => value === null || validStatusValues.includes(value),
			{
				message: "Invalid status value",
			}
		);
	const isValidStatus = statusSchema.safeParse(status);
	if (!isValidStatus.success) {
		return {
			statusCode: 400,
			headers: {
				"Access-Control-Allow-Origin": "*",
			},
			body: JSON.stringify({
				error: isValidStatus.error.issues[0].message,
			}),
		};
	}
	const client = await connectToDatabase();
	try {
		let query = `
                    select 
                        p.id as project_id,
                        p.project->>'name' as proejct_name,
                        p.project->>'image_url' as project_icon_url,
                        p.project->>'status' as status,
                        p.project->'team'->'roles' as roles,
                        COUNT(u.id) as total_usecases
                    from 
                        projects_table as p
                    left join 
                        usecases_table as u on p.id = u.project_id`;
		let queryparams = [];
		if (status != null) {
			query += `
                    where 
                        p.project->>'status' = $1`;
			queryparams.push(status);
		}
		query += `
                    group by
                        p.id
					LIMIT 10 OFFSET ${offset}`;
		
		const result = await client.query(query, queryparams);
		console.log("result", result.rowCount)
		const totalRecords = result.rowCount
		const totalPages = Math.ceil(totalRecords / limit)
		let response = result.rows.map(
			({
				project_id,
				proejct_name,
				project_icon_url,
				status,
				roles,
				total_usecases,
			}) => {
				let res = roles?.map((e) => Object.values(e)).flat();
				return {
					id: project_id,
					name: proejct_name,
					image_url: project_icon_url,
					status,
					total_resources: new Set(res?.flat()).size,
					total_usecases: parseInt(total_usecases),
				};
			}
		);
		return {
			statusCode: 200,
			headers: {
				"Access-Control-Allow-Origin": "*",
			},
			body: JSON.stringify({
				totalPages: totalPages,
				currentPage: page,
				projects: response,
			}),
		};
	} catch (error) {
		return {
			statusCode: 500,
			headers: {
				"Access-Control-Allow-Origin": "*",
			},
			body: JSON.stringify({ 
				message: error.message,
				error: error
			}),
		};
	} finally {
		await client.end();
	}
};
