const { connectToDatabase } = require("../db/dbConnector");
exports.handler = async (event) => {
    const projectFilter = event.queryStringParameters && event.queryStringParameters.project_id;
    const client = await connectToDatabase();
    try {
        // const client = await connectToDatabase();

        const queryParams = [];

        const resourcesQuery = `
                                SELECT 
                                e.id AS resource_id,
                                e.first_name || ' ' || e.last_name AS employee_name,
                                empd.designation AS employee_role,
                                e.image AS resource_img_url,
                                e.work_email AS resource_email
                            FROM 
                                employee e
                            LEFT JOIN
                                emp_detail d ON e.id = d.emp_id
                            LEFT JOIN
                                emp_designation empd ON empd.id = d.designation_id
                            GROUP BY
                                e.id,empd.designation,  e.first_name, e.last_name, e.image, e.email;`;
        let projectsQuery = `
        SELECT
            id,
            project->>'name' AS name,
            project->>'project_icon_url' AS project_icon_url,
            project->>'team' AS team
        FROM
            projects_table
      `;

        if (projectFilter) {
            projectsQuery += `
                WHERE
                    id = $1`;
            queryParams.push(projectFilter);
        }
        console.log(queryParams)
        const resourcesResult = await client.query(resourcesQuery);
        const projectsResult = await client.query(projectsQuery, queryParams);

        const outputData = processResourcesData(resourcesResult.rows, projectsResult.rows, projectFilter);

        return {
            statusCode: 200,
            headers: {
               "Access-Control-Allow-Origin": "*",
				"Access-Control-Allow-Credentials": true,
            },
            body: JSON.stringify(outputData),
        };
    } catch (error) {
        console.error('Error executing query:', error);
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

function processResourcesData(resources, projects, projectFilter) {
    const outputData = [];

    for (const resource of resources) {
        const resourceId = resource.resource_id;
        const resourceName = resource.employee_name;
        const resourceRole = resource.employee_role || "";
        const resourceImgUrl = resource.resource_img_url || "";
        const resourceEmail = resource.resource_email || "";

        const resourceProjects = projects
            // .filter(project => {
            //     const team = JSON.parse(project.team);
            //     return team.roles.some(role =>
            //         Object.values(role).flat().includes(resourceId)
            //     );
            // })
            .map(project => ({
                project_id: project.id,
                project_name: project.name,
                project_img_url: project.project_icon_url,
            }));
            console.log(resourceProjects)
        if (projectFilter) {
            const filteredProjects = resourceProjects.filter(project => project.project_id === projectFilter);
            if (filteredProjects.length > 0) {
                outputData.push({
                    resource_id: resourceId,
                    resource_name: resourceName,
                    role: resourceRole,
                    resource_img_url: resourceImgUrl,
                    resource_email: resourceEmail,
                    projects: filteredProjects,
                });
            }
        } else {
            outputData.push({
                resource_id: resourceId,
                resource_name: resourceName,
                role: resourceRole,
                resource_img_url: resourceImgUrl,
                resource_email: resourceEmail,
                projects: resourceProjects,
            });
        }
    }

    return outputData;
}