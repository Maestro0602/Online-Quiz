import { Module, Controller, Get } from '@nestjs/common';
import { AuthController } from './routes/auth.js';
import { QuizzesController } from './routes/quizzes.js';
import { SessionsController } from './routes/sessions.js';
import { GameGateway } from './socket/handler.js';

@Controller('api/health')
export class HealthController {
  @Get()
  getHealth() {
    return {
      status: 'ok',
      framework: 'NestJS',
      timestamp: new Date().toISOString()
    };
  }
}

@Module({
  imports: [],
  controllers: [
    HealthController,
    AuthController,
    QuizzesController,
    SessionsController
  ],
  providers: [GameGateway]
})
export class AppModule {}
