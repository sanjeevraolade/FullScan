export interface FieldConfig {
  readonly key: string;
  readonly label: string;
  readonly type: 'text' | 'date' | 'location' | 'status' | 'image' | 'badge';
  readonly visible: boolean;
  readonly order: number;
}

export interface ComponentConfig {
  readonly type: 'card' | 'list' | 'form' | 'detail' | 'header';
  readonly fields: FieldConfig[];
}

export interface ScreenConfig {
  readonly screenId: string;
  readonly version: number;
  readonly title: string;
  readonly components: ComponentConfig[];
  readonly updatedAt: string;
}

export interface UiConfigRow {
  readonly id: string;
  readonly screen_id: string;
  readonly version: number;
  readonly title: string;
  readonly config_json: string;
  readonly created_at: string;
  readonly updated_at: string;
}

export interface ApiResponse<T> {
  readonly success: boolean;
  readonly data?: T;
  readonly error?: string;
}
