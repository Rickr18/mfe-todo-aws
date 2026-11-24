# API TODO · Parte 2 con CORS

Es la API de la Parte 2 (API Gateway + Lambda + DynamoDB + SNS + SQS) con un solo
cambio en `template.yaml`: el recurso `TodosApi` declara `Cors`.

Sin eso la API no responde al *preflight* `OPTIONS` que el navegador envía antes de
un POST con JSON, un PUT o un DELETE hacia otro dominio, y el editor no podría
escribir desde CloudFront. Los GET del viewer sí funcionaban, porque no llevan preflight.

Despliegue (en AWS CloudShell): `sam build && sam deploy --guided` con el stack `todo-api`.
