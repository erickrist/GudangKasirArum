import { Package } from 'lucide-react';

const EmptyState = ({ title, description, icon: Icon = Package }) => {
  return (
    <div className="flex flex-col items-center justify-center h-64 text-gray-400">
      <Icon className="w-16 h-16 mb-4" />
      <h3 className="text-lg font-semibold mb-2">{title}</h3>
      <p className="text-sm">{description}</p>
    </div>
  );
};

export default EmptyState;
