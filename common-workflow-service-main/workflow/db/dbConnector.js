const { Client } = require("pg");
require("dotenv").config();
const {
	SecretsManagerClient,
	GetSecretValueCommand,
} = require("@aws-sdk/client-secrets-manager");

async function connectToDatabase() {
	try {
		const secretsManagerClient = new SecretsManagerClient({
			region: "us-east-1",
		});
		const configuration = await secretsManagerClient.send(
			new GetSecretValueCommand({
				SecretId: "serverless/lambda/credintials",
			})
		);
		const dbConfig = JSON.parse(configuration.SecretString);
		const client = new Client({
			host: dbConfig.host,
			port: dbConfig.port,
			database: "workflow",
			user: dbConfig.engine,
			password: dbConfig.password,
		});
		await client.connect();
		return client;
	} catch (err) {
		console.log("secret manager :" + err.message);
		try{
			const client = new Client({
				host: process.env.HOST,
				port: process.env.PORT,
				database: "workflow",
				user: process.env.USER,
				password: process.env.PASSOWRD,
			});
			await client.connect();
			return client;
		}catch(error){
			console.log("database :" + error.message);
		}
	}
}

module.exports = {
	connectToDatabase,
};
