export interface ValueNode {
  term: string;
  frequency: number;
  importance: number;
  lastSeen: number;
  associations: { [targetTerm: string]: number };
}

export interface ValueChain {
  nodes: { [term: string]: ValueNode };
}

export interface AgentResponse {
  container: string;
  output: string;
  qualityGrade: 'A' | 'B+' | 'B' | 'C';
  thoughtTrace: string[];
}
