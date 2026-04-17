import {
	IExecuteFunctions,
	INodeExecutionData,
	INodeType,
	INodeTypeDescription,
	NodeOperationError,
} from 'n8n-workflow';

export class PaperClaw implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'PaperClaw',
		name: 'paperClaw',
		// eslint-disable-next-line n8n-nodes-base/node-class-description-icon-not-svg
		icon: 'file:paperclaw.svg',
		group: ['transform'],
		version: 1,
		subtitle: '={{$parameter["operation"]}}',
		description: 'Generate and publish peer-reviewed research papers via P2PCLAW',
		defaults: {
			name: 'PaperClaw',
		},
		inputs: ['main'],
		outputs: ['main'],
		properties: [
			{
				displayName: 'Operation',
				name: 'operation',
				type: 'options',
				noDataExpression: true,
				options: [
					{
						name: 'Generate Paper',
						value: 'generatePaper',
						description: 'Generate and publish a peer-reviewed research paper',
						action: 'Generate and publish a peer-reviewed research paper',
					},
				],
				default: 'generatePaper',
			},
			// ─── Generate Paper fields ───────────────────────────────────────────
			{
				displayName: 'Research Description',
				name: 'description',
				type: 'string',
				typeOptions: { rows: 5 },
				displayOptions: { show: { operation: ['generatePaper'] } },
				default: '',
				placeholder:
					'Describe your research idea in detail, e.g. "A distributed key-value store using consistent hashing and quorum replication…"',
				description:
					'Research idea or project description (30–4000 characters). More detail produces a better paper.',
				required: true,
			},
			{
				displayName: 'Author Name',
				name: 'author',
				type: 'string',
				displayOptions: { show: { operation: ['generatePaper'] } },
				default: 'n8n Workflow',
				description: 'Author name to print on the paper',
			},
			{
				displayName: 'Tags',
				name: 'tags',
				type: 'string',
				displayOptions: { show: { operation: ['generatePaper'] } },
				default: '',
				placeholder: 'ai, distributed-systems, cryptography',
				description: 'Comma-separated topic tags (optional, max 10)',
			},
		],
	};

	async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
		const items = this.getInputData();
		const returnData: INodeExecutionData[] = [];

		for (let i = 0; i < items.length; i++) {
			const operation = this.getNodeParameter('operation', i) as string;

			if (operation === 'generatePaper') {
				const description = this.getNodeParameter('description', i) as string;
				const author = this.getNodeParameter('author', i, 'n8n Workflow') as string;
				const rawTags = this.getNodeParameter('tags', i, '') as string;

				if (description.trim().length < 30) {
					throw new NodeOperationError(
						this.getNode(),
						'Research description must be at least 30 characters.',
						{ itemIndex: i },
					);
				}

				const tags = rawTags
					? rawTags
							.split(',')
							.map((t) => t.trim())
							.filter(Boolean)
							.slice(0, 10)
					: [];

				const response = await this.helpers.httpRequest({
					method: 'POST',
					url: 'https://www.p2pclaw.com/api/paperclaw/generate',
					body: {
						description: description.trim().slice(0, 4000),
						author,
						tags,
						client: 'paperclaw-n8n-community',
					},
					json: true,
					timeout: 120000,
				});

				if (!response.success) {
					throw new NodeOperationError(
						this.getNode(),
						`PaperClaw API error: ${response.message ?? response.error ?? 'Unknown error'}`,
						{ itemIndex: i },
					);
				}

				returnData.push({
					json: {
						success: true,
						url: response.url as string,
						title: (response.title as string) ?? 'Untitled',
						wordCount: (response.wordCount as number) ?? 0,
						pdfUrl: `${response.url as string}#print`,
						llmProvider: (response.llm as { provider?: string })?.provider ?? 'unknown',
					},
					pairedItem: { item: i },
				});
			}
		}

		return [returnData];
	}
}
