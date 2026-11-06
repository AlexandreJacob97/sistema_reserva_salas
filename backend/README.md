# Backend

API Node.js separada do frontend em `../frontend`, com MySQL para desenvolvimento
local via Docker Compose.

## Executar API e banco

Na raiz do repositório:

```sh
docker compose -f backend/compose.yaml up --build
```

O endpoint `GET http://localhost:3000/api/health` verifica a conexão com o
MySQL. A interface fica disponível em `http://localhost:8080`; o Compose
inicializa as tabelas e os dados de exemplo automaticamente na primeira criação
do volume do banco. As rotas `GET /api/rooms`, `GET /api/reservations` e
`POST /api/reservations` abastecem a tela de salas e reservas. Novas solicitações
começam pendentes e horários conflitantes são recusados.
O formulário solicita a quantidade de alunos, destaca as salas compatíveis e
mantém todas as opções de sala selecionáveis. A API recusa solicitações acima
da capacidade da sala.

A carga inicial contém sete salas (Horizonte, Laboratório Criativo, Ipê, Acácia,
Aurora, Laboratório de Ciências e Multimídia) e dez reservas de exemplo, com
situações pendentes, aprovadas e canceladas. Há exemplos de reservas no mesmo
horário em salas diferentes. Horários sobrepostos são recusados quando se trata
da mesma sala e data, mas são permitidos entre salas diferentes. O Compose
preserva os dados em um volume; alterações posteriores na carga inicial não
substituem dados de um volume já existente.

A configuração padrão do Compose é somente para desenvolvimento local;
defina `MYSQL_PASSWORD` e `MYSQL_ROOT_PASSWORD` no ambiente antes de usar em
qualquer ambiente compartilhado.

Para executar os testes sem Docker:

```sh
cd backend
npm install
npm test
```

O login e a recuperação de senha ainda não foram conectados à API. É necessário
definir o contrato de autenticação e um provedor de envio de email antes de
implementar esses fluxos. A API não permite alterar a situação das reservas;
aprovação e cancelamento exigem autenticação e autorização de gerente.
