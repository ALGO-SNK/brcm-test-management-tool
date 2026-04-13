interface IconProps {
  size?: number;
  className?: string;
  filled?: boolean;
}

interface MaterialIconProps extends IconProps {
  name: string;
}

function MaterialIcon({ name, size = 18, className, filled = false }: MaterialIconProps) {
  return (
    <span
      className={`app-icon material-symbols-rounded${filled ? ' app-icon--filled' : ''}${className ? ` ${className}` : ''}`}
      style={{ fontSize: `${size}px`, width: `${size}px`, height: `${size}px` }}
      aria-hidden="true"
    >
      {name}
    </span>
  );
}

export function IconRefresh(props: IconProps) {
  return <MaterialIcon name="refresh" {...props} />;
}

export function IconSettings(props: IconProps) {
  return <MaterialIcon name="settings" {...props} />;
}

export function IconSun(props: IconProps) {
  return <MaterialIcon name="light_mode" {...props} />;
}

export function IconMoon(props: IconProps) {
  return <MaterialIcon name="dark_mode" {...props} />;
}

export function IconArrowRight(props: IconProps) {
  return <MaterialIcon name="arrow_forward" {...props} />;
}

export function IconPlus(props: IconProps) {
  return <MaterialIcon name="add" {...props} />;
}

export function IconSave(props: IconProps) {
  return <MaterialIcon name="save" {...props} />;
}

export function IconDownload(props: IconProps) {
  return <MaterialIcon name="download" {...props} />;
}

export function IconTrash(props: IconProps) {
  return <MaterialIcon name="delete" {...props} />;
}

export function IconCopy(props: IconProps) {
  return <MaterialIcon name="content_copy" {...props} />;
}

export function IconX(props: IconProps) {
  return <MaterialIcon name="close" {...props} />;
}

export function IconChevronRight(props: IconProps) {
  return <MaterialIcon name="chevron_right" {...props} />;
}

export function IconSearch(props: IconProps) {
  return <MaterialIcon name="search" {...props} />;
}

export function IconVisibility(props: IconProps) {
  return <MaterialIcon name="visibility" {...props} />;
}

export function IconEdit(props: IconProps) {
  return <MaterialIcon name="edit" {...props} />;
}

export function IconHelp(props: IconProps) {
  return <MaterialIcon name="help" {...props} />;
}

export function IconExpandMore(props: IconProps) {
  return <MaterialIcon name="keyboard_arrow_down" {...props} />;
}

export function IconChevronDown(props: IconProps) {
  return <MaterialIcon name="expand_more" {...props} />;
}

export function IconFolder(props: IconProps) {
  return <MaterialIcon name="folder" {...props} />;
}

export function IconFolderOpen(props: IconProps) {
  return <MaterialIcon name="folder_open" {...props} />;
}

export function IconDragHandle(props: IconProps) {
  return <MaterialIcon name="drag_indicator" {...props} />;
}

export function IconFilterList(props: IconProps) {
  return <MaterialIcon name="filter_list" {...props} />;
}
