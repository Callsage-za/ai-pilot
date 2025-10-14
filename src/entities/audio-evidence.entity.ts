import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn } from 'typeorm';
import { AudioFile } from './audio-file.entity';

@Entity('audio_evidence')
export class AudioEvidence {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ nullable: true })
  text: string;

  @Column({ nullable: true })
  startMs: number;

  @Column({ nullable: true })
  endMs: number;

  @Column()
  audioId: string;

  @ManyToOne(() => AudioFile, audioFile => audioFile.evidence)
  @JoinColumn({ name: 'audioId' })
  audio: AudioFile;
}
