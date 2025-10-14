import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, ManyToOne, JoinColumn, Unique, Index } from 'typeorm';
import { Policy } from './policy.entity';

@Entity('policy_sections')
export class PolicySection {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  policyId: string;

  @Column()
  sectionId: string;

  @Column({ nullable: true })
  parentId: string;

  @Column()
  level: number;

  @Column()
  title: string;

  @Column('text')
  exactText: string;

  @Column()
  sha256: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @ManyToOne(() => Policy, policy => policy.sections)
  @JoinColumn({ name: 'policyId' })
  policy: Policy;
}
