import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, Index } from 'typeorm';

@Entity('calls')
export class Call {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true })
  callId: string;

  @Column()
  startedAt: Date;

  @Column({ nullable: true })
  endedAt: Date;

  @Column({ nullable: true })
  durationSec: number;

  @Column({ nullable: true })
  agentId: string;

  @Column({ nullable: true })
  customerId: string;

  @Column({ nullable: true })
  transcriptText: string;

  @Column({ nullable: true })
  transcriptUri: string;

  @Column({ nullable: true })
  transcriptSha256: string;

  @Column({ nullable: true })
  language: string;

  @Column({ nullable: true })
  summary: string;

  @Column({ nullable: true })
  classification: string; // "complaint" | "compliment" | "other"

  @Column({ nullable: true })
  sentiment: string; // "negative" | "neutral" | "positive"

  @Column({ nullable: true })
  severity: string; // "low" | "medium" | "high"

  @Column('json', { nullable: true })
  intentsJson: any; // e.g. ["billing_inquiry","refund_request"]

  @Column('json', { nullable: true })
  entities: any; // { account_id, ... }

  @Column('json', { nullable: true })
  evidence: any; // [{ speaker, text, start_ms, end_ms }]

  @Column({ nullable: true })
  classifierConf: number;

  @Column('json', { nullable: true })
  policyAudit: any; // overall + findings

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
