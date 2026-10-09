import { Injectable } from '@nestjs/common';

@Injectable()
export class AppService {
  getHello() {
    return {
      message: 'Click Up API',
      docs: '/api/health',
    };
  }
}
