import { Injectable } from '@nestjs/common';
import { renderAsync } from '@react-email/components';

import { UserService } from '@/user/user.service';

@Injectable()
export class MailService {
  constructor(private readonly userService: UserService) {}

  async sendMail(userId: string, ...params: Parameters<typeof renderAsync>) {
    const { email } = await this.userService.getById(userId);

    /** Rendered html content as string. */
    const html = await renderAsync(...params);

    console.log({
      email,
      html,
    });
  }
}