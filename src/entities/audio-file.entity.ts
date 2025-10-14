import { Entity, PrimaryGeneratedColumn, Column, OneToOne, OneToMany, ManyToOne, JoinColumn, UpdateDateColumn, CreateDateColumn } from 'typeorm';
import { AudioEntities } from './audio-entities.entity';
import { AudioEvidence } from './audio-evidence.entity';
import { AudioClassification, AudioSentiment, AudioSeverity } from '../utils/types';
import { User } from './user.entity';
import { Organization } from './organization.entity';

@Entity('audio_files')
export class AudioFile {
  @PrimaryGeneratedColumn('uuid')
  id?: string;

  @Column()
  path?: string;

  @Column('text')
  transcript?: string;

  @Column({ nullable: true ,type: 'text'})
  summary: string;

  @Column({
    type: 'enum',
    enum: AudioClassification,
    nullable: true
  })
  classification: AudioClassification;

  @Column({
    type: 'enum',
    enum: AudioSentiment,
    nullable: true
  })
  sentiment?: AudioSentiment;

  @Column({
    type: 'enum',
    enum: AudioSeverity,
    nullable: true
  })
  severity?: AudioSeverity;

  @Column({ default: false, nullable: true })
  resolved: boolean;

  @Column({ nullable: true })
  userId: string; // Who uploaded this audio file

  @Column({ nullable: true })
  organizationId: string; // Which organization this audio file belongs to

  @ManyToOne(() => User, user => user.audioFiles)
  @JoinColumn({ name: 'userId' })
  user: User;

  @ManyToOne(() => Organization, organization => organization.audioFiles)
  @JoinColumn({ name: 'organizationId' })
  organization: Organization;

  @OneToOne(() => AudioEntities, audioEntity => audioEntity.audio)
  audioEntity?: AudioEntities;

  @OneToMany(() => AudioEvidence, evidence => evidence.audio)
  evidence?: AudioEvidence[];
  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;  
}
