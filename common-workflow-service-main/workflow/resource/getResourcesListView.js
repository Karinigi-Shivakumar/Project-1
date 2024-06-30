const { connectToDatabase } = require("../db/dbConnector");
exports.handler = async (event) => {
    const projectId = event.queryStringParameters && event.queryStringParameters.project_id;
    const client = await connectToDatabase();
    try {
        // const client = await connectToDatabase();
        const resourcesQuery = `
                                    SELECT
                                    e.id AS resource_id,
                                    e.first_name || ' ' || e.last_name AS resource_name,
                                    empd.designation AS employee_role,
                                    e.image AS resource_img_url,
                                    e.email AS resource_email,
                                    COUNT(t.id) AS total_tasks
                                FROM
                                    employee e
                                LEFT JOIN
                                    emp_detail d ON e.id = d.emp_id
                                LEFT JOIN
                                    emp_designation empd ON empd.id = d.designation_id
                                LEFT JOIN
                                    tasks_table t ON e.id = t.assignee_id
                                GROUP BY
                                    e.id, r.id, e.first_name, e.last_name, e.image, e.email
                                HAVING
                                    COUNT(t.id) > 0; -- Only include resources with tasks
                            `;

        let projectsQuery = `
            SELECT DISTINCT
                p.id AS project_id,
                p.project->>'name' AS project_name,
                p.project->>'project_icon_url' AS project_img_url,
                t.assignee_id AS resource_id
            FROM
                projects_table p
                JOIN usecases_table u ON p.id = u.project_id
                JOIN tasks_table t ON u.id = t.usecase_id
        `;

        const queryParams = [];

        if (projectId) {
            projectsQuery += `
                WHERE
                p.id = $1`;
            queryParams.push(projectId);
        }

        const tasksResult = await client.query(resourcesQuery);
        const projectsResult = await client.query(projectsQuery, queryParams);

        const resourcesResult = tasksResult.rows.map((resource) => {

            const resourceProjects = projectsResult.rows
                .filter((project) => project.resource_id === resource.resource_id)
                .map((project) => ({
                    project_id: project.project_id,
                    project_name: project.project_name,
                    project_img_url: project.project_img_url,
                }));

            const includeResource = resourceProjects.length > 0 || !projectId;

            return includeResource ? {
                resource_id: resource.resource_id,
                resource_name: resource.resource_name,
                total_tasks: parseInt(resource.total_tasks) || 0,
                total_projects: resourceProjects.length,
                role: resource.role,
                resource_img_url: resource.resource_img_url,
                resource_email: resource.resource_email,
                projects: resourceProjects,
            } : null;
        }).filter(Boolean);

        const response = {
            statusCode: 200,
            headers: {
               "Access-Control-Allow-Origin": "*",
				"Access-Control-Allow-Credentials": true,
            },
            body: JSON.stringify(resourcesResult),
        };

        return response;
    } catch (err) {
        console.error('Error executing query', err);
        return {
            statusCode: 500,
            headers: {
               "Access-Control-Allow-Origin": "*",
				"Access-Control-Allow-Credentials": true,
            },
            body: JSON.stringify({ message: 'Internal Server Error' }),
        };
    } finally {
        await client.end();
    }
};
