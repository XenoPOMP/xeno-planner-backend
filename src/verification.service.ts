import {
  Injectable,
  Logger,
  OnModuleInit,
  UnprocessableEntityException,
} from '@nestjs/common';
import { randomStringGenerator } from '@nestjs/common/utils/random-string-generator.util';
import { VerificationStatus } from '@prisma/client';
import { hash, verify } from 'argon2';

import { PrismaService } from '@/prisma.service';

@Injectable()
export class VerificationService implements OnModuleInit {
  constructor(private readonly prisma: PrismaService) {}

  /** Returns string of oldest allowed date. */
  private getTimeThreshold(): string {
    return new Date().toISOString().split('T')[0];
  }

  /** Clears stale verifications. */
  private async clearStale() {
    const today = new Date().toISOString().split('T')[0];

    // Clear all verifications that are too old
    // and not accepted.
    const deletionInfo = await this.prisma.userVerification.deleteMany({
      where: {
        status: {
          not: VerificationStatus.accepted,
        },
        createdAt: {
          lt: new Date(today),
        },
      },
    });

    // Log deletion info only if any deleted
    if (deletionInfo.count > 0) {
      Logger.log(`Deleted stale verifications: ${deletionInfo.count}`);
    }
  }

  async onModuleInit() {
    await this.clearStale();
  }

  async getByUserId(userId: string) {
    await this.clearStale();

    return this.prisma.userVerification.findFirst({
      where: {
        userId,
      },
      orderBy: {
        updatedAt: 'desc',
      },
    });
  }

  /**
   * This method contains logic related to
   * sending email and creating verification record in database.
   * @param userId
   */
  async requestVerification(userId: string) {
    /** Not encoded secret word yet. */
    const secret = randomStringGenerator();

    /** Create verification record. */
    await this.prisma.userVerification.create({
      data: {
        secret: await hash(secret),

        user: {
          connect: {
            id: userId,
          },
        },
      },
    });

    console.log({
      userId,
      secret,
    });
  }

  /**
   * Compares the encrypted secret with the provided one
   * @param userId
   * @param secret
   */
  async verify(userId: string, secret: string): Promise<boolean> {
    const { secret: encodedSecret, status } = await this.getByUserId(userId);

    if (status === VerificationStatus.accepted) {
      throw new UnprocessableEntityException('User already verified');
    }

    /** True if provided secret and cuid are correct. */
    const isValid = await verify(encodedSecret, secret);

    /** If data is valid, change status to accepted. */
    if (isValid) {
      await this.prisma.userVerification.update({
        where: {
          userId,
        },
        data: {
          status: VerificationStatus.accepted,
        },
      });
    }

    return isValid;
  }
}